import { createHash } from "node:crypto";
import { fbDb } from "./firebase-admin";
import { logger } from "./logger";

export interface RateRecord {
  sendCount: number;
  firstSendAt: number;
  verifyAttempts: number;
  blockedUntil?: number;
  dailyBlocks: number;
  dailyBlocksDay: number;
}

export interface SecurityLogEntry {
  phoneHash: string;
  action: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface OtpRecord {
  otpHash: string;
  expiry: number;
  attempts: number;
  fullName: string;
  sentAt: number;
}

export interface PaymentAttemptRecord {
  count: number;
  firstAt: number;
}

export interface PendingRegistration {
  fullName: string;
  createdAt: number;
}

const memRate = new Map<string, RateRecord>();
const memBlacklist = new Map<string, number>();
const memSessions = new Map<string, string>();
const memOtp = new Map<string, OtpRecord>();
const memPay = new Map<string, PaymentAttemptRecord>();
const memPending = new Map<string, PendingRegistration>();

const PENDING_TTL_MS = 15 * 60 * 1000;

function hashKey(s: string): string {
  return createHash("sha256").update(`taryaq:key:${s}`).digest("hex").slice(0, 32);
}

function ratePath(phoneHash: string): string {
  return `security/rateLimits/${phoneHash}`;
}
function blacklistPath(jti: string): string {
  return `security/blacklist/${jti}`;
}
function sessionPath(phoneHash: string): string {
  return `security/sessions/${phoneHash}`;
}
function otpPath(phone: string): string {
  return `security/otpStore/${hashKey(phone)}`;
}
function payAttemptPath(bookingId: string): string {
  return `security/paymentAttempts/${hashKey(bookingId)}`;
}
function pendingPath(phoneHash: string): string {
  return `security/pendingRegistrations/${phoneHash}`;
}

/* -------------------------- generic helpers -------------------------- */

async function withRetry<T>(op: () => Promise<T>, attempts: number = 3, baseMs: number = 150): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseMs * Math.pow(2, i)));
      }
    }
  }
  throw lastErr;
}

/* ----------------------------- Rate limits ----------------------------- */

export async function getRate(phoneHash: string): Promise<RateRecord | null> {
  const db = fbDb();
  if (!db) return memRate.get(phoneHash) ?? null;
  try {
    const snap = await db.ref(ratePath(phoneHash)).get();
    return snap.exists() ? (snap.val() as RateRecord) : null;
  } catch (err) {
    logger.error({ err }, "[security-store] getRate failed, fallback to memory");
    return memRate.get(phoneHash) ?? null;
  }
}

/**
 * Atomic transaction-based mutator. Use for any read-modify-write on rate limits
 * to avoid the lost-update race. The mutator MUST be pure and may run multiple
 * times. Return undefined to abort the write.
 */
export async function mutateRate(
  phoneHash: string,
  mutator: (current: RateRecord | null) => RateRecord | null | undefined,
): Promise<RateRecord | null> {
  const db = fbDb();
  if (!db) {
    const cur = memRate.get(phoneHash) ?? null;
    const next = mutator(cur);
    if (next === undefined) return cur;
    if (next === null) memRate.delete(phoneHash);
    else memRate.set(phoneHash, next);
    return next ?? null;
  }
  try {
    const result = await db.ref(ratePath(phoneHash)).transaction((current) => {
      const out = mutator((current as RateRecord) ?? null);
      if (out === undefined) return undefined;
      return out;
    });
    const finalVal = (result.snapshot.val() as RateRecord | null) ?? null;
    if (finalVal) memRate.set(phoneHash, finalVal);
    else memRate.delete(phoneHash);
    return finalVal;
  } catch (err) {
    logger.error({ err }, "[security-store] mutateRate failed, fallback to memory");
    const cur = memRate.get(phoneHash) ?? null;
    const next = mutator(cur);
    if (next === undefined) return cur;
    if (next === null) memRate.delete(phoneHash);
    else memRate.set(phoneHash, next);
    return next ?? null;
  }
}

export async function deleteRate(phoneHash: string): Promise<void> {
  memRate.delete(phoneHash);
  const db = fbDb();
  if (!db) return;
  try {
    await db.ref(ratePath(phoneHash)).remove();
  } catch (err) {
    logger.error({ err }, "[security-store] deleteRate failed");
  }
}

/* ----------------------------- Blacklist ----------------------------- */

export async function isBlacklisted(key: string): Promise<boolean> {
  const memExp = memBlacklist.get(key);
  if (memExp && memExp > Date.now()) return true;
  if (memExp && memExp <= Date.now()) memBlacklist.delete(key);

  const db = fbDb();
  if (!db) return false;
  try {
    const snap = await db.ref(blacklistPath(key)).get();
    if (!snap.exists()) return false;
    const exp = snap.val() as { expiresAt: number };
    if (exp.expiresAt < Date.now()) {
      await db.ref(blacklistPath(key)).remove().catch(() => undefined);
      return false;
    }
    memBlacklist.set(key, exp.expiresAt);
    return true;
  } catch (err) {
    logger.error({ err }, "[security-store] isBlacklisted failed");
    return false;
  }
}

export async function addBlacklist(key: string, expiresAt: number): Promise<void> {
  memBlacklist.set(key, expiresAt);
  const db = fbDb();
  if (!db) return;
  try {
    await withRetry(() => db.ref(blacklistPath(key)).set({ expiresAt }), 3, 150);
  } catch (err) {
    logger.error({ err, key }, "[security-store] addBlacklist failed after 3 retries — kept only in memory");
  }
}

/* ----------------------------- Sessions ----------------------------- */

export async function getActiveSession(phoneHash: string): Promise<string | null> {
  const mem = memSessions.get(phoneHash);
  if (mem) return mem;
  const db = fbDb();
  if (!db) return null;
  try {
    const snap = await db.ref(sessionPath(phoneHash)).get();
    if (!snap.exists()) return null;
    const v = snap.val() as { sessionId: string };
    memSessions.set(phoneHash, v.sessionId);
    return v.sessionId;
  } catch (err) {
    logger.error({ err }, "[security-store] getActiveSession failed");
    return null;
  }
}

export async function setActiveSession(phoneHash: string, sessionId: string): Promise<void> {
  memSessions.set(phoneHash, sessionId);
  const db = fbDb();
  if (!db) return;
  try {
    await withRetry(
      () => db.ref(sessionPath(phoneHash)).set({ sessionId, updatedAt: Date.now() }),
      3,
      150,
    );
  } catch (err) {
    logger.error({ err }, "[security-store] setActiveSession failed after retries");
  }
}

export async function deleteActiveSession(phoneHash: string): Promise<void> {
  memSessions.delete(phoneHash);
  const db = fbDb();
  if (!db) return;
  try {
    await db.ref(sessionPath(phoneHash)).remove();
  } catch (err) {
    logger.error({ err }, "[security-store] deleteActiveSession failed");
  }
}

/* ------------------------------- OTP ------------------------------- */

export async function setOtp(phone: string, record: OtpRecord): Promise<void> {
  memOtp.set(phone, record);
  const db = fbDb();
  if (!db) return;
  try {
    await db.ref(otpPath(phone)).set(record);
  } catch (err) {
    logger.error({ err }, "[security-store] setOtp failed");
  }
}

export async function getOtp(phone: string): Promise<OtpRecord | null> {
  const mem = memOtp.get(phone);
  if (mem) {
    if (Date.now() > mem.expiry) {
      memOtp.delete(phone);
    } else {
      return mem;
    }
  }
  const db = fbDb();
  if (!db) return null;
  try {
    const snap = await db.ref(otpPath(phone)).get();
    if (!snap.exists()) return null;
    const r = snap.val() as OtpRecord;
    if (Date.now() > r.expiry) {
      await db.ref(otpPath(phone)).remove().catch(() => undefined);
      return null;
    }
    memOtp.set(phone, r);
    return r;
  } catch (err) {
    logger.error({ err }, "[security-store] getOtp failed");
    return null;
  }
}

export async function deleteOtp(phone: string): Promise<void> {
  memOtp.delete(phone);
  const db = fbDb();
  if (!db) return;
  try {
    await db.ref(otpPath(phone)).remove();
  } catch (err) {
    logger.error({ err }, "[security-store] deleteOtp failed");
  }
}

export async function updateOtpAttempts(phone: string, attempts: number): Promise<void> {
  const r = memOtp.get(phone);
  if (r) memOtp.set(phone, { ...r, attempts });
  const db = fbDb();
  if (!db) return;
  try {
    await db.ref(`${otpPath(phone)}/attempts`).set(attempts);
  } catch (err) {
    logger.error({ err }, "[security-store] updateOtpAttempts failed");
  }
}

/** Sweep expired OTPs from memory + Firebase. Called periodically. */
export async function sweepExpiredOtps(): Promise<void> {
  const now = Date.now();
  for (const [k, v] of memOtp.entries()) if (now > v.expiry) memOtp.delete(k);
  const db = fbDb();
  if (!db) return;
  try {
    const snap = await db.ref("security/otpStore").get();
    if (!snap.exists()) return;
    const all = snap.val() as Record<string, OtpRecord>;
    const updates: Record<string, null> = {};
    for (const [k, v] of Object.entries(all)) {
      if (now > v.expiry) updates[`security/otpStore/${k}`] = null;
    }
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }
  } catch (err) {
    logger.error({ err }, "[security-store] sweepExpiredOtps failed");
  }
}

/* -------------------------- Security logs -------------------------- */

export async function appendSecurityLog(entry: SecurityLogEntry): Promise<void> {
  const db = fbDb();
  if (!db) return;
  try {
    await db.ref(`security/logs/${entry.timestamp}_${Math.random().toString(36).slice(2, 8)}`).set(entry);
  } catch (err) {
    logger.error({ err }, "[security-store] appendSecurityLog failed");
  }
}

export async function listRecentLogs(limit: number = 200): Promise<SecurityLogEntry[]> {
  const db = fbDb();
  if (!db) return [];
  try {
    const snap = await db.ref("security/logs").limitToLast(limit).get();
    if (!snap.exists()) return [];
    const obj = snap.val() as Record<string, SecurityLogEntry>;
    return Object.values(obj).sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    logger.error({ err }, "[security-store] listRecentLogs failed");
    return [];
  }
}

/* ---------------------- Payment attempt limit ---------------------- */

export interface PaymentAttemptResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export async function consumePaymentAttempt(
  bookingId: string,
  windowMs: number,
  maxAttempts: number,
): Promise<PaymentAttemptResult> {
  const db = fbDb();
  const now = Date.now();

  const apply = (cur: PaymentAttemptRecord | null): {
    next: PaymentAttemptRecord | null | undefined;
    result: PaymentAttemptResult;
  } => {
    if (!cur || now - cur.firstAt > windowMs) {
      return {
        next: { count: 1, firstAt: now },
        result: { allowed: true, remaining: maxAttempts - 1 },
      };
    }
    if (cur.count >= maxAttempts) {
      return {
        next: undefined,
        result: { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - cur.firstAt) },
      };
    }
    return {
      next: { count: cur.count + 1, firstAt: cur.firstAt },
      result: { allowed: true, remaining: maxAttempts - (cur.count + 1) },
    };
  };

  if (!db) {
    const cur = memPay.get(bookingId) ?? null;
    const { next, result } = apply(cur);
    if (next !== undefined) {
      if (next === null) memPay.delete(bookingId);
      else memPay.set(bookingId, next);
    }
    return result;
  }

  try {
    let captured: PaymentAttemptResult = { allowed: false, remaining: 0 };
    await db.ref(payAttemptPath(bookingId)).transaction((current) => {
      const cur = (current as PaymentAttemptRecord | null) ?? null;
      const { next, result } = apply(cur);
      captured = result;
      return next === undefined ? undefined : next;
    });
    return captured;
  } catch (err) {
    logger.error({ err }, "[security-store] consumePaymentAttempt failed, fallback to memory");
    const cur = memPay.get(bookingId) ?? null;
    const { next, result } = apply(cur);
    if (next !== undefined) {
      if (next === null) memPay.delete(bookingId);
      else memPay.set(bookingId, next);
    }
    return result;
  }
}

export async function resetPaymentAttempts(bookingId: string): Promise<void> {
  memPay.delete(bookingId);
  const db = fbDb();
  if (!db) return;
  try {
    await db.ref(payAttemptPath(bookingId)).remove();
  } catch (err) {
    logger.error({ err }, "[security-store] resetPaymentAttempts failed");
  }
}

/* --------------------- Pending registrations (15 min TTL) --------------------- */

export async function setPendingRegistration(
  phoneHash: string,
  data: PendingRegistration,
): Promise<void> {
  memPending.set(phoneHash, data);
  const db = fbDb();
  if (!db) return;
  try {
    await db.ref(pendingPath(phoneHash)).set(data);
  } catch (err) {
    logger.error({ err }, "[security-store] setPendingRegistration failed");
  }
}

export async function getPendingRegistration(phoneHash: string): Promise<PendingRegistration | null> {
  const mem = memPending.get(phoneHash);
  if (mem) {
    if (Date.now() - mem.createdAt > PENDING_TTL_MS) {
      memPending.delete(phoneHash);
    } else {
      return mem;
    }
  }
  const db = fbDb();
  if (!db) return null;
  try {
    const snap = await db.ref(pendingPath(phoneHash)).get();
    if (!snap.exists()) return null;
    const r = snap.val() as PendingRegistration;
    if (Date.now() - r.createdAt > PENDING_TTL_MS) {
      await db.ref(pendingPath(phoneHash)).remove().catch(() => undefined);
      return null;
    }
    memPending.set(phoneHash, r);
    return r;
  } catch (err) {
    logger.error({ err }, "[security-store] getPendingRegistration failed");
    return null;
  }
}

export async function deletePendingRegistration(phoneHash: string): Promise<void> {
  memPending.delete(phoneHash);
  const db = fbDb();
  if (!db) return;
  try {
    await db.ref(pendingPath(phoneHash)).remove();
  } catch (err) {
    logger.error({ err }, "[security-store] deletePendingRegistration failed");
  }
}
