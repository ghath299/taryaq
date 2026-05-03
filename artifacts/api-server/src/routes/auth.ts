import { Router, type Request, type Response } from "express";
import { createHash, randomInt } from "node:crypto";
import { logger } from "../lib/logger";
import { issueTokens, refreshAccessToken, logoutSession, verifyToken } from "../lib/jwt";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import {
  mutateRate,
  appendSecurityLog,
  listRecentLogs,
  setOtp,
  getOtp,
  deleteOtp,
  updateOtpAttempts,
  sweepExpiredOtps,
  type RateRecord,
  type SecurityLogEntry,
} from "../lib/security-store";

const router = Router();

const CONFIG = {
  OTP_EXPIRY_MS: 5 * 60 * 1000,
  OTP_MAX_VERIFY_ATTEMPTS: 5,
  RATE_SEND_MAX: 3,
  RATE_SEND_WINDOW_MS: 10 * 60 * 1000,
  BLOCK_DURATION_MS: 30 * 60 * 1000,
  DAILY_BLOCK_LIMIT: 3,
  LONG_BLOCK_DURATION_MS: 24 * 60 * 60 * 1000,
  MIN_OTP_INPUT_TIME_MS: 1000,
  IRAQ_PHONE_REGEX: /^07[3-9]\d{8}$/,
  NAME_MIN_WORDS: 2,
  NAME_MAX_LENGTH: 50,
  PHONE_MAX_LENGTH: 11,
  MASTER_PHONE: process.env["MASTER_PHONE"] ?? "07700000000",
  MASTER_OTP: process.env["MASTER_OTP"] ?? "123456",
  GENERIC_INVALID_OTP: "رمز غير صحيح أو منتهي الصلاحية",
  GENERIC_BLOCKED: "تم تجاوز الحد المسموح. يرجى المحاولة لاحقاً",
};

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
function hashPhone(phone: string): string {
  return sha256(`taryaq:phone:${phone}`).slice(0, 32);
}
function generateSecureOTP(): string {
  return randomInt(100000, 1000000).toString();
}
function sanitizeName(input: string): string {
  return input
    .replace(/[<>"'`;{}()$\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CONFIG.NAME_MAX_LENGTH);
}
function sanitizePhone(input: string): string {
  return input.replace(/\D/g, "").slice(0, CONFIG.PHONE_MAX_LENGTH);
}
function todayDay(): number {
  return Math.floor(Date.now() / (24 * 60 * 60 * 1000));
}

async function logSecurity(entry: Omit<SecurityLogEntry, "timestamp">): Promise<void> {
  const full: SecurityLogEntry = { ...entry, timestamp: Date.now() };
  logger.info({ security: full }, "[SECURITY]");
  await appendSecurityLog(full);
}

function freshRate(): RateRecord {
  return {
    sendCount: 0,
    firstSendAt: 0,
    verifyAttempts: 0,
    dailyBlocks: 0,
    dailyBlocksDay: todayDay(),
  };
}

function progressiveDelayMs(attempt: number): number {
  if (attempt <= 2) return 0;
  if (attempt === 3) return 2000;
  if (attempt === 4) return 5000;
  return 10000;
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* Periodic sweeps */
setInterval(() => {
  void sweepExpiredOtps();
}, 60 * 1000).unref();

async function sendViaTelegram(chatId: string, text: string): Promise<boolean> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = (await res.json()) as { ok: boolean };
    return data.ok === true;
  } catch (err) {
    logger.error({ err }, "Telegram send failed");
    return false;
  }
}

/* ----- Atomic rate-limit consumers (transaction-based) ----- */

interface SendDecision {
  ok: boolean;
  blocked: boolean;
  newlyBlocked: boolean;
}

async function tryConsumeSend(phoneHash: string): Promise<SendDecision> {
  const decision: SendDecision = { ok: false, blocked: false, newlyBlocked: false };
  await mutateRate(phoneHash, (cur) => {
    const today = todayDay();
    const r: RateRecord = cur ? { ...cur } : freshRate();
    if (r.dailyBlocksDay !== today) {
      r.dailyBlocks = 0;
      r.dailyBlocksDay = today;
    }
    if (r.blockedUntil && Date.now() < r.blockedUntil) {
      decision.blocked = true;
      return r;
    } else if (r.blockedUntil) {
      delete r.blockedUntil;
    }
    if (!r.firstSendAt || Date.now() - r.firstSendAt > CONFIG.RATE_SEND_WINDOW_MS) {
      r.firstSendAt = Date.now();
      r.sendCount = 0;
    }
    if (r.sendCount >= CONFIG.RATE_SEND_MAX) {
      r.dailyBlocks++;
      const dur =
        r.dailyBlocks >= CONFIG.DAILY_BLOCK_LIMIT
          ? CONFIG.LONG_BLOCK_DURATION_MS
          : CONFIG.BLOCK_DURATION_MS;
      r.blockedUntil = Date.now() + dur;
      r.verifyAttempts = 0;
      r.sendCount = 0;
      decision.blocked = true;
      decision.newlyBlocked = true;
      return r;
    }
    r.sendCount++;
    decision.ok = true;
    return r;
  });
  return decision;
}

interface VerifyDecision {
  blocked: boolean;
  newlyBlocked: boolean;
  verifyAttempts: number;
}

async function tryConsumeVerify(phoneHash: string): Promise<VerifyDecision> {
  const decision: VerifyDecision = { blocked: false, newlyBlocked: false, verifyAttempts: 0 };
  await mutateRate(phoneHash, (cur) => {
    const today = todayDay();
    const r: RateRecord = cur ? { ...cur } : freshRate();
    if (r.dailyBlocksDay !== today) {
      r.dailyBlocks = 0;
      r.dailyBlocksDay = today;
    }
    if (r.blockedUntil && Date.now() < r.blockedUntil) {
      decision.blocked = true;
      decision.verifyAttempts = r.verifyAttempts;
      return r;
    } else if (r.blockedUntil) {
      delete r.blockedUntil;
    }
    r.verifyAttempts++;
    if (r.verifyAttempts >= CONFIG.OTP_MAX_VERIFY_ATTEMPTS) {
      r.dailyBlocks++;
      const dur =
        r.dailyBlocks >= CONFIG.DAILY_BLOCK_LIMIT
          ? CONFIG.LONG_BLOCK_DURATION_MS
          : CONFIG.BLOCK_DURATION_MS;
      r.blockedUntil = Date.now() + dur;
      r.verifyAttempts = 0;
      r.sendCount = 0;
      decision.blocked = true;
      decision.newlyBlocked = true;
    }
    decision.verifyAttempts = r.verifyAttempts;
    return r;
  });
  return decision;
}

async function resetRateOnSuccess(phoneHash: string): Promise<void> {
  await mutateRate(phoneHash, (cur) => {
    if (!cur) return undefined;
    return { ...cur, sendCount: 0, verifyAttempts: 0 };
  });
}

/* ---------------------------- Routes ---------------------------- */

router.post("/send-otp", async (req: Request, res: Response) => {
  const body = req.body as {
    phoneNumber?: string;
    fullName?: string;
    channel?: string;
    honeypot?: string;
  };

  const phoneRaw = typeof body.phoneNumber === "string" ? sanitizePhone(body.phoneNumber) : "";
  const nameRaw = typeof body.fullName === "string" ? sanitizeName(body.fullName) : "";
  const honeypot = typeof body.honeypot === "string" ? body.honeypot : "";
  const ip = req.ip ?? "unknown";

  if (honeypot.length > 0) {
    const phoneHash = phoneRaw ? hashPhone(phoneRaw) : "anon";
    await logSecurity({ phoneHash, action: "honeypot_triggered", ip });
    res.status(400).json({ message: CONFIG.GENERIC_BLOCKED });
    return;
  }

  if (!phoneRaw || !CONFIG.IRAQ_PHONE_REGEX.test(phoneRaw)) {
    await logSecurity({
      phoneHash: phoneRaw ? hashPhone(phoneRaw) : "invalid",
      action: "invalid_input",
      ip,
      meta: { reason: "phone" },
    });
    res.status(400).json({ message: "رقم الهاتف العراقي غير صحيح" });
    return;
  }

  const wordCount = nameRaw.split(/\s+/).filter((w) => w.length > 1).length;
  if (!nameRaw || wordCount < CONFIG.NAME_MIN_WORDS) {
    res.status(400).json({ message: "الاسم يجب أن يكون ثلاثياً على الأقل" });
    return;
  }

  const phoneHash = hashPhone(phoneRaw);
  await logSecurity({ phoneHash, action: "otp_request", ip });

  if (phoneRaw === CONFIG.MASTER_PHONE) {
    await setOtp(phoneRaw, {
      otpHash: sha256(CONFIG.MASTER_OTP),
      expiry: Date.now() + CONFIG.OTP_EXPIRY_MS,
      attempts: 0,
      fullName: nameRaw,
      sentAt: Date.now(),
    });
    logger.info({ phoneHash }, "Master phone — fixed OTP");
    res.json({ success: true, message: "تم إرسال رمز التحقق", sentAt: Date.now() });
    return;
  }

  const dec = await tryConsumeSend(phoneHash);
  if (dec.blocked) {
    if (dec.newlyBlocked) await logSecurity({ phoneHash, action: "blocked", ip, meta: { stage: "send" } });
    res.status(429).json({ message: CONFIG.GENERIC_BLOCKED });
    return;
  }

  const otp = generateSecureOTP();
  const sentAt = Date.now();
  await setOtp(phoneRaw, {
    otpHash: sha256(otp),
    expiry: sentAt + CONFIG.OTP_EXPIRY_MS,
    attempts: 0,
    fullName: nameRaw,
    sentAt,
  });

  const message = `🔐 <b>ترياق — رمز التحقق</b>\n\nرمز التحقق الخاص بك:\n\n<code>${otp}</code>\n\nصالح لمدة 5 دقائق. لا تشاركه مع أحد.`;
  const sent = await sendViaTelegram(phoneRaw, message);
  if (!sent) logger.warn({ phoneHash, otp }, "=== DEV OTP (Telegram not configured) ===");
  await logSecurity({ phoneHash, action: "otp_sent", ip, meta: { telegramOk: sent } });

  res.json({ success: true, message: "تم إرسال رمز التحقق", sentAt });
});

router.post("/verify-otp", async (req: Request, res: Response) => {
  const body = req.body as {
    phoneNumber?: string;
    otp?: string;
    inputDurationMs?: number;
    honeypot?: string;
  };

  const phoneRaw = typeof body.phoneNumber === "string" ? sanitizePhone(body.phoneNumber) : "";
  const otpRaw = typeof body.otp === "string" ? body.otp.replace(/\D/g, "").slice(0, 6) : "";
  const inputDurationMs = typeof body.inputDurationMs === "number" ? body.inputDurationMs : 9999;
  const honeypot = typeof body.honeypot === "string" ? body.honeypot : "";
  const ip = req.ip ?? "unknown";

  if (!phoneRaw || !otpRaw) {
    res.status(400).json({ success: false, message: "بيانات غير مكتملة" });
    return;
  }

  const phoneHash = hashPhone(phoneRaw);

  if (honeypot.length > 0) {
    await logSecurity({ phoneHash, action: "honeypot_triggered", ip, meta: { stage: "verify" } });
    res.status(400).json({ success: false, message: CONFIG.GENERIC_INVALID_OTP });
    return;
  }
  if (inputDurationMs < CONFIG.MIN_OTP_INPUT_TIME_MS) {
    await logSecurity({ phoneHash, action: "bot_timing", ip, meta: { inputDurationMs } });
    res.status(400).json({ success: false, message: CONFIG.GENERIC_INVALID_OTP });
    return;
  }

  const dec = await tryConsumeVerify(phoneHash);
  await sleep(progressiveDelayMs(dec.verifyAttempts));
  if (dec.blocked) {
    if (dec.newlyBlocked) {
      await deleteOtp(phoneRaw);
      await logSecurity({ phoneHash, action: "blocked", ip, meta: { stage: "verify" } });
    }
    res.status(429).json({ success: false, message: CONFIG.GENERIC_BLOCKED });
    return;
  }

  const record = await getOtp(phoneRaw);
  if (!record) {
    await logSecurity({ phoneHash, action: "verify_failed", ip, meta: { reason: "expired_or_missing" } });
    res.status(400).json({ success: false, message: CONFIG.GENERIC_INVALID_OTP });
    return;
  }

  const newAttempts = record.attempts + 1;
  await updateOtpAttempts(phoneRaw, newAttempts);
  if (newAttempts > CONFIG.OTP_MAX_VERIFY_ATTEMPTS) {
    await deleteOtp(phoneRaw);
    res.status(429).json({ success: false, message: CONFIG.GENERIC_BLOCKED });
    return;
  }

  if (sha256(otpRaw) !== record.otpHash) {
    const remaining = CONFIG.OTP_MAX_VERIFY_ATTEMPTS - dec.verifyAttempts;
    await logSecurity({ phoneHash, action: "verify_failed", ip, meta: { remaining } });
    res.status(400).json({
      success: false,
      message: CONFIG.GENERIC_INVALID_OTP,
      attemptsRemaining: Math.max(0, remaining),
    });
    return;
  }

  await deleteOtp(phoneRaw);
  await resetRateOnSuccess(phoneHash);
  await logSecurity({ phoneHash, action: "verify_success", ip });

  const tokens = await issueTokens(phoneRaw);
  res.json({
    success: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt: tokens.accessExpiresAt,
    refreshExpiresAt: tokens.refreshExpiresAt,
  });
});

router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ message: "refresh token مطلوب" });
    return;
  }
  const tokens = await refreshAccessToken(refreshToken);
  if (!tokens) {
    res.status(401).json({ message: "الجلسة منتهية — سجّل الدخول من جديد" });
    return;
  }
  res.json({
    success: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt: tokens.accessExpiresAt,
    refreshExpiresAt: tokens.refreshExpiresAt,
  });
});

router.post("/logout", async (req: Request, res: Response) => {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (header && header.startsWith("Bearer ")) {
    const payload = await verifyToken(header.slice(7).trim(), "access");
    if (payload) await logoutSession(payload.phoneHash, payload.sessionId);
  }
  res.json({ success: true });
});

router.get("/me", requireAuth, (req: Request, res: Response) => {
  const auth = (req as AuthedRequest).auth;
  res.json({ phoneHash: auth?.phoneHash, sessionId: auth?.sessionId });
});

router.get("/security/logs", async (req: Request, res: Response) => {
  const adminToken = req.header("x-admin-token");
  if (!adminToken || adminToken !== process.env["ADMIN_SECURITY_TOKEN"]) {
    res.status(403).json({ message: "ممنوع" });
    return;
  }
  const logs = await listRecentLogs(200);
  res.json({ logs });
});

export default router;
