import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

interface OTPRecord {
  otp: string;
  expiry: number;
  attempts: number;
  fullName: string;
}

interface RateRecord {
  count: number;
  firstRequest: number;
  blockedUntil?: number;
}

const otpStore = new Map<string, OTPRecord>();
const rateLimitStore = new Map<string, RateRecord>();

const CONFIG = {
  OTP_EXPIRY_MS: 5 * 60 * 1000,
  OTP_MAX_ATTEMPTS: 5,
  RATE_SEND_MAX: 3,
  RATE_SEND_WINDOW_MS: 10 * 60 * 1000,
  BLOCK_DURATION_MS: 30 * 60 * 1000,
  IRAQ_PHONE_REGEX: /^07[3-9]\d{8}$/,
  NAME_MIN_WORDS: 2,
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isRateLimited(phone: string): boolean {
  const record = rateLimitStore.get(phone);
  if (!record) return false;
  if (record.blockedUntil && Date.now() < record.blockedUntil) return true;
  if (Date.now() - record.firstRequest > CONFIG.RATE_SEND_WINDOW_MS) {
    rateLimitStore.delete(phone);
    return false;
  }
  return record.count >= CONFIG.RATE_SEND_MAX;
}

function recordRateLimit(phone: string): void {
  const record = rateLimitStore.get(phone);
  if (!record) {
    rateLimitStore.set(phone, { count: 1, firstRequest: Date.now() });
    return;
  }
  if (Date.now() - record.firstRequest > CONFIG.RATE_SEND_WINDOW_MS) {
    rateLimitStore.set(phone, { count: 1, firstRequest: Date.now() });
    return;
  }
  record.count++;
  if (record.count >= CONFIG.RATE_SEND_MAX) {
    record.blockedUntil = Date.now() + CONFIG.BLOCK_DURATION_MS;
  }
  rateLimitStore.set(phone, record);
}

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
  const { phoneNumber, fullName, channel = "telegram" } = req.body as {
    phoneNumber?: string;
    fullName?: string;
    channel?: string;
  };

  if (!phoneNumber || !CONFIG.IRAQ_PHONE_REGEX.test(phoneNumber)) {
    res.status(400).json({ message: "رقم الهاتف العراقي غير صحيح" });
    return;
  }

  if (!fullName || fullName.trim().split(/\s+/).filter((w) => w.length > 1).length < CONFIG.NAME_MIN_WORDS) {
    res.status(400).json({ message: "الاسم يجب أن يكون ثلاثياً على الأقل" });
    return;
  }

  if (isRateLimited(phoneNumber)) {
    res.status(429).json({ message: "تجاوزت الحد المسموح. حاول لاحقاً" });
    return;
  }

  const otp = generateOTP();
  const expiry = Date.now() + CONFIG.OTP_EXPIRY_MS;
  otpStore.set(phoneNumber, { otp, expiry, attempts: 0, fullName: fullName.trim() });
  recordRateLimit(phoneNumber);

  const message = `🔐 <b>ترياق — رمز التحقق</b>\n\nرمز التحقق الخاص بك:\n\n<code>${otp}</code>\n\nصالح لمدة 5 دقائق. لا تشاركه مع أحد.`;

  const sent = await sendViaTelegram(phoneNumber, message);

  if (!sent) {
    logger.info({ phoneNumber, otp }, "OTP generated (Telegram not configured, see log)");
    logger.warn({ otp, phoneNumber }, "=== DEV OTP (Telegram not sent) ===");
  } else {
    logger.info({ phoneNumber }, "OTP sent via Telegram");
  }

  res.json({ success: true, message: "تم إرسال رمز التحقق" });
});

router.post("/verify-otp", (req: Request, res: Response) => {
  const { phoneNumber, otp } = req.body as { phoneNumber?: string; otp?: string };

  if (!phoneNumber || !otp) {
    res.status(400).json({ success: false, message: "بيانات غير مكتملة" });
    return;
  }

  const record = otpStore.get(phoneNumber);
  if (!record) {
    res.status(400).json({ success: false, message: "لم يتم إرسال رمز لهذا الرقم" });
    return;
  }

  if (Date.now() > record.expiry) {
    otpStore.delete(phoneNumber);
    res.status(400).json({ success: false, message: "انتهت صلاحية الرمز — يرجى طلب رمز جديد" });
    return;
  }

  record.attempts++;
  if (record.attempts > CONFIG.OTP_MAX_ATTEMPTS) {
    otpStore.delete(phoneNumber);
    res.status(429).json({ success: false, message: "تجاوزت محاولات التحقق المسموحة" });
    return;
  }

  if (record.otp !== otp.trim()) {
    const remaining = CONFIG.OTP_MAX_ATTEMPTS - record.attempts;
    res.status(400).json({ success: false, message: "الرمز غير صحيح", attemptsRemaining: remaining });
    return;
  }

  otpStore.delete(phoneNumber);
  logger.info({ phoneNumber }, "OTP verified successfully");
  res.json({ success: true });
});

export default router;
