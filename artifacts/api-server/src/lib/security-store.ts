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

const memRate = new Map<string, RateRecord>();
const memBlacklist = new Map<string, number>();
const memSessions = new Map<string, string>();

function ratePath(phoneHash: string): string {
  return `security/rateLimits/${phoneHash}`;
}

function blacklistPath(jti: string): string {
  return `security/blacklist/${jti}`;
}

function sessionPath(phoneHash: string): string {
  return `security/sessions/${phoneHash}`;
}

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

export async function setRate(phoneHash: string, r: RateRecord): Promise<void> {
  memRate.set(phoneHash, r);
  const db = fbDb();
  if (!db) return;
  try {
    await db.ref(ratePath(phoneHash)).set(r);
  } catch (err) {
    logger.error({ err }, "[security-store] setRate failed");
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
      await db.ref(blacklistPath(key)).remove();
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
    await db.ref(blacklistPath(key)).set({ expiresAt });
  } catch (err) {
    logger.error({ err }, "[security-store] addBlacklist failed");
  }
}

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
    await db.ref(sessionPath(phoneHash)).set({ sessionId, updatedAt: Date.now() });
  } catch (err) {
    logger.error({ err }, "[security-store] setActiveSession failed");
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
