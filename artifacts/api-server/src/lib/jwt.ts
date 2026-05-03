import jwt, { type SignOptions, type JwtPayload } from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";

const ACCESS_TTL = "7d";
const REFRESH_TTL = "30d";
const ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SECRET: string = process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"] ?? "dev-only-insecure-secret-change-me";

export interface TokenPayload extends JwtPayload {
  sub: string;
  phoneHash: string;
  sessionId: string;
  type: "access" | "refresh";
  jti: string;
}

interface IssueResult {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  sessionId: string;
}

const activeSessionByPhone = new Map<string, string>();
const blacklistedJti = new Set<string>();
const blacklistExpiry = new Map<string, number>();

function newJti(): string {
  return randomBytes(16).toString("hex");
}

function newSessionId(): string {
  return randomBytes(12).toString("hex");
}

export function hashPhone(phone: string): string {
  return createHash("sha256").update(`taryaq:phone:${phone}`).digest("hex").slice(0, 32);
}

export function issueTokens(phone: string): IssueResult {
  const phoneHash = hashPhone(phone);
  const sessionId = newSessionId();

  const prevSession = activeSessionByPhone.get(phoneHash);
  if (prevSession) {
    blacklistSession(prevSession);
  }
  activeSessionByPhone.set(phoneHash, sessionId);

  const now = Date.now();
  const accessJti = newJti();
  const refreshJti = newJti();

  const baseAccess: SignOptions = { expiresIn: ACCESS_TTL, jwtid: accessJti, subject: phoneHash };
  const baseRefresh: SignOptions = { expiresIn: REFRESH_TTL, jwtid: refreshJti, subject: phoneHash };

  const accessToken = jwt.sign({ phoneHash, sessionId, type: "access" }, SECRET, baseAccess);
  const refreshToken = jwt.sign({ phoneHash, sessionId, type: "refresh" }, SECRET, baseRefresh);

  return {
    accessToken,
    refreshToken,
    accessExpiresAt: now + ACCESS_TTL_MS,
    refreshExpiresAt: now + REFRESH_TTL_MS,
    sessionId,
  };
}

export function verifyToken(token: string, expectedType: "access" | "refresh"): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET) as TokenPayload;
    if (decoded.type !== expectedType) return null;
    if (!decoded.jti || blacklistedJti.has(decoded.jti)) return null;
    if (blacklistedJti.has(`session:${decoded.sessionId}`)) return null;
    const active = activeSessionByPhone.get(decoded.phoneHash);
    if (!active || active !== decoded.sessionId) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function blacklistJti(jti: string, expiresInMs: number = REFRESH_TTL_MS): void {
  blacklistedJti.add(jti);
  blacklistExpiry.set(jti, Date.now() + expiresInMs);
}

export function blacklistSession(sessionId: string): void {
  const key = `session:${sessionId}`;
  blacklistedJti.add(key);
  blacklistExpiry.set(key, Date.now() + REFRESH_TTL_MS);
}

export function logoutSession(phoneHash: string, sessionId: string): void {
  blacklistSession(sessionId);
  const active = activeSessionByPhone.get(phoneHash);
  if (active === sessionId) activeSessionByPhone.delete(phoneHash);
}

export function refreshAccessToken(refreshToken: string): IssueResult | null {
  const decoded = verifyToken(refreshToken, "refresh");
  if (!decoded) return null;

  blacklistJti(decoded.jti);
  if (decoded.exp) blacklistJti(`refresh:${decoded.jti}`, decoded.exp * 1000 - Date.now());

  const sessionId = decoded.sessionId;
  const phoneHash = decoded.phoneHash;
  const accessJti = newJti();
  const refreshJti = newJti();
  const now = Date.now();

  const accessToken = jwt.sign(
    { phoneHash, sessionId, type: "access" },
    SECRET,
    { expiresIn: ACCESS_TTL, jwtid: accessJti, subject: phoneHash },
  );
  const newRefresh = jwt.sign(
    { phoneHash, sessionId, type: "refresh" },
    SECRET,
    { expiresIn: REFRESH_TTL, jwtid: refreshJti, subject: phoneHash },
  );

  return {
    accessToken,
    refreshToken: newRefresh,
    accessExpiresAt: now + ACCESS_TTL_MS,
    refreshExpiresAt: now + REFRESH_TTL_MS,
    sessionId,
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [jti, exp] of blacklistExpiry.entries()) {
    if (exp < now) {
      blacklistedJti.delete(jti);
      blacklistExpiry.delete(jti);
    }
  }
}, 60 * 60 * 1000).unref();
