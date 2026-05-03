import { Router, type Request, type Response } from "express";
import { createHash, randomInt } from "node:crypto";
import { logger } from "../lib/logger";

const router = Router();

interface OTPRecord {
  otpHash: string;
  expiry: number;
  attempts: number;
  fullName: string;
  sentAt: number;
}

interface RateRecord {
  sendCount: number;
  firstSendAt: number;
  verifyAttempts: number;
  blockedUntil?: number;
  dailyBlocks: number;
  dailyBlocksDay: number;
}

interface SecurityLog {
  phoneHash: string;
  action:
    | "otp_request"
    | "otp_sent"
    | "verify_success"
    | "verify_failed"
    | "blocked"
    | "honeypot_triggered"
    | "bot_timing"
    | "invalid_input";
  ip?: string;
  userAgent?: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

const otpStore = new Map<string, OTPRecord>();
const rateLimitStore = new Map<string, RateRecord>();
const securityLogs: SecurityLog[] = [];
const MAX_LOGS_IN_MEMORY = 500;

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

function logSecurity(entry: Omit<SecurityLog, "timestamp">): void {
  const full: SecurityLog = { ...entry, timestamp: Date.now() };
  securityLogs.push(full);
  if (securityLogs.length > MAX_LOGS_IN_MEMORY) {
    securityLogs.splice(0, securityLogs.length - MAX_LOGS_IN_MEMORY);
  }
  logger.info({ security: full }, "[SECURITY]");
}

function getOrCreateRate(phoneHash: string): RateRecord {
  let r = rateLimitStore.get(phoneHash);
  const today = todayDay();
  if (!r) {
    r = { sendCount: 0, firstSendAt: 0, verifyAttempts: 0, dailyBlocks: 0, dailyBlocksDay: today };
    rateLimitStore.set(phoneHash, r);
  }
  if (r.dailyBlocksDay !== today) {
    r.dailyBlocks = 0;
    r.dailyBlocksDay = today;
  }
  return r;
}

function isCurrentlyBlocked(r: RateRecord): boolean {
  return !!r.blockedUntil && Date.now() < r.blockedUntil;
}

function applyBlock(phoneHash: string, r: RateRecord): void {
  r.dailyBlocks++;
  const duration =
    r.dailyBlocks >= CONFIG.DAILY_BLOCK_LIMIT
      ? CONFIG.LONG_BLOCK_DURATION_MS
      : CONFIG.BLOCK_DURATION_MS;
  r.blockedUntil = Date.now() + duration;
  r.verifyAttempts = 0;
  r.sendCount = 0;
  logSecurity({ phoneHash, action: "blocked", meta: { duration, dailyBlocks: r.dailyBlocks } });
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

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of otpStore.entries()) {
    if (now > v.expiry) otpStore.delete(k);
  }
  for (const [k, v] of rateLimitStore.entries()) {
    const stale = !v.blockedUntil || v.blockedUntil < now;
    const oldSend = !v.firstSendAt || now - v.firstSendAt > CONFIG.RATE_SEND_WINDOW_MS;
    const noDaily = v.dailyBlocks === 0;
    if (stale && oldSend && noDaily && v.verifyAttempts === 0) rateLimitStore.delete(k);
  }
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
    logSecurity({ phoneHash, action: "honeypot_triggered", ip });
    res.status(400).json({ message: CONFIG.GENERIC_BLOCKED });
    return;
  }

  if (!phoneRaw || !CONFIG.IRAQ_PHONE_REGEX.test(phoneRaw)) {
    logSecurity({
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
  const rate = getOrCreateRate(phoneHash);

  if (isCurrentlyBlocked(rate)) {
    logSecurity({ phoneHash, action: "blocked", ip, meta: { stage: "send" } });
    res.status(429).json({ message: CONFIG.GENERIC_BLOCKED });
    return;
  }

  logSecurity({ phoneHash, action: "otp_request", ip });

  if (phoneRaw === CONFIG.MASTER_PHONE) {
    otpStore.set(phoneRaw, {
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

  if (!rate.firstSendAt || Date.now() - rate.firstSendAt > CONFIG.RATE_SEND_WINDOW_MS) {
    rate.firstSendAt = Date.now();
    rate.sendCount = 0;
  }
  if (rate.sendCount >= CONFIG.RATE_SEND_MAX) {
    applyBlock(phoneHash, rate);
    res.status(429).json({ message: CONFIG.GENERIC_BLOCKED });
    return;
  }
  rate.sendCount++;

  const otp = generateSecureOTP();
  const sentAt = Date.now();
  otpStore.set(phoneRaw, {
    otpHash: sha256(otp),
    expiry: sentAt + CONFIG.OTP_EXPIRY_MS,
    attempts: 0,
    fullName: nameRaw,
    sentAt,
  });

  const message = `🔐 <b>ترياق — رمز التحقق</b>\n\nرمز التحقق الخاص بك:\n\n<code>${otp}</code>\n\nصالح لمدة 5 دقائق. لا تشاركه مع أحد.`;
  const sent = await sendViaTelegram(phoneRaw, message);

  if (!sent) {
    logger.warn({ phoneHash, otp }, "=== DEV OTP (Telegram not configured) ===");
  }
  logSecurity({ phoneHash, action: "otp_sent", ip, meta: { telegramOk: sent } });

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
    logSecurity({ phoneHash, action: "honeypot_triggered", ip, meta: { stage: "verify" } });
    res.status(400).json({ success: false, message: CONFIG.GENERIC_INVALID_OTP });
    return;
  }

  if (inputDurationMs < CONFIG.MIN_OTP_INPUT_TIME_MS) {
    logSecurity({ phoneHash, action: "bot_timing", ip, meta: { inputDurationMs } });
    res.status(400).json({ success: false, message: CONFIG.GENERIC_INVALID_OTP });
    return;
  }

  const rate = getOrCreateRate(phoneHash);
  if (isCurrentlyBlocked(rate)) {
    res.status(429).json({ success: false, message: CONFIG.GENERIC_BLOCKED });
    return;
  }

  const record = otpStore.get(phoneRaw);
  if (!record || Date.now() > record.expiry) {
    if (record) otpStore.delete(phoneRaw);
    rate.verifyAttempts++;
    await sleep(progressiveDelayMs(rate.verifyAttempts));
    logSecurity({ phoneHash, action: "verify_failed", ip, meta: { reason: "expired_or_missing" } });
    res.status(400).json({ success: false, message: CONFIG.GENERIC_INVALID_OTP });
    return;
  }

  record.attempts++;
  rate.verifyAttempts++;

  await sleep(progressiveDelayMs(rate.verifyAttempts));

  if (
    record.attempts > CONFIG.OTP_MAX_VERIFY_ATTEMPTS ||
    rate.verifyAttempts >= CONFIG.OTP_MAX_VERIFY_ATTEMPTS
  ) {
    otpStore.delete(phoneRaw);
    applyBlock(phoneHash, rate);
    res.status(429).json({ success: false, message: CONFIG.GENERIC_BLOCKED });
    return;
  }

  const submittedHash = sha256(otpRaw);
  if (submittedHash !== record.otpHash) {
    const remaining = CONFIG.OTP_MAX_VERIFY_ATTEMPTS - rate.verifyAttempts;
    logSecurity({ phoneHash, action: "verify_failed", ip, meta: { remaining } });
    res.status(400).json({
      success: false,
      message: CONFIG.GENERIC_INVALID_OTP,
      attemptsRemaining: Math.max(0, remaining),
    });
    return;
  }

  otpStore.delete(phoneRaw);
  rate.verifyAttempts = 0;
  rate.sendCount = 0;
  logSecurity({ phoneHash, action: "verify_success", ip });
  res.json({ success: true });
});

router.get("/security/logs", (req: Request, res: Response) => {
  const adminToken = req.header("x-admin-token");
  if (!adminToken || adminToken !== process.env["ADMIN_SECURITY_TOKEN"]) {
    res.status(403).json({ message: "ممنوع" });
    return;
  }
  res.json({ logs: securityLogs.slice(-200) });
});

export default router;
