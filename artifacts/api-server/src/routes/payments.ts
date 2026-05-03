import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import {
  consumePaymentAttempt,
  resetPaymentAttempts,
  appendSecurityLog,
} from "../lib/security-store";

const router = Router();

const PAYMENT_WINDOW_MS = 10 * 60 * 1000;
const PAYMENT_MAX_ATTEMPTS = 3;

/**
 * POST /api/payments/qicard/attempt
 * Authenticated. Atomically consumes one payment attempt for a bookingId.
 * Returns { allowed, remaining, retryAfterMs? }.
 *
 * The mobile client MUST call this BEFORE invoking the Qi Card processor,
 * so the rate limit is enforced server-side and cannot be bypassed by
 * restarting the app.
 */
router.post("/qicard/attempt", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as { bookingId?: string };
  const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  if (!bookingId || bookingId.length > 128) {
    res.status(400).json({ message: "bookingId مطلوب" });
    return;
  }

  const result = await consumePaymentAttempt(
    bookingId,
    PAYMENT_WINDOW_MS,
    PAYMENT_MAX_ATTEMPTS,
  );

  if (!result.allowed) {
    await appendSecurityLog({
      phoneHash: "payment",
      action: "payment_rate_limited",
      ip: req.ip ?? "unknown",
      timestamp: Date.now(),
      meta: { bookingId, retryAfterMs: result.retryAfterMs },
    });
    res.status(429).json({
      allowed: false,
      remaining: 0,
      retryAfterMs: result.retryAfterMs,
      message: "تجاوزت الحد الأقصى لمحاولات الدفع. يرجى المحاولة بعد 10 دقائق.",
    });
    return;
  }

  res.json({ allowed: true, remaining: result.remaining });
});

/**
 * POST /api/payments/qicard/reset
 * Authenticated. Clears attempts counter for a booking (e.g. after successful payment).
 */
router.post("/qicard/reset", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as { bookingId?: string };
  const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  if (!bookingId) {
    res.status(400).json({ message: "bookingId مطلوب" });
    return;
  }
  await resetPaymentAttempts(bookingId);
  res.json({ success: true });
});

export default router;
