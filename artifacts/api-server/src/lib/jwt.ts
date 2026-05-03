import jwt, { type SignOptions, type JwtPayload } from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import {
  getActiveSession,
  setActiveSession,
  deleteActiveSession,
  isBlacklisted,
  addBlacklist,
} from "./security-store";

const ACCESS_TTL = "7d";
const REFRESH_TTL = "30d";
const ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SECRET: string =
  process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"] ?? "dev-only-insecure-secret-change-me";

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

function newJti(): string {
  return randomBytes(16).toString("hex");
}

function newSessionId(): string {
  return randomBytes(12).toString("hex");
}

export function hashPhone(phone: string): string {
  return createHash("sha256").update(`taryaq:phone:${phone}`).digest("hex").slice(0, 32);
}

function sign(phoneHash: string, sessionId: string, type: "access" | "refresh"): { token: string; jti: string } {
  const jti = newJti();
  const ttl = type === "access" ? ACCESS_TTL : REFRESH_TTL;
  const opts: SignOptions = { expiresIn: ttl, jwtid: jti, subject: phoneHash };
  const token = jwt.sign({ phoneHash, sessionId, type }, SECRET, opts);
  return { token, jti };
}

export async function issueTokens(phone: string): Promise<IssueResult> {
  const phoneHash = hashPhone(phone);
  const sessionId = newSessionId();

  const prevSession = await getActiveSession(phoneHash);
  if (prevSession) {
    await addBlacklist(`session:${prevSession}`, Date.now() + REFRESH_TTL_MS);
  }
  await setActiveSession(phoneHash, sessionId);

  const access = sign(phoneHash, sessionId, "access");
  const refresh = sign(phoneHash, sessionId, "refresh");
  const now = Date.now();

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessExpiresAt: now + ACCESS_TTL_MS,
    refreshExpiresAt: now + REFRESH_TTL_MS,
    sessionId,
  };
}

export async function verifyToken(token: string, expectedType: "access" | "refresh"): Promise<TokenPayload | null> {
  try {
    const decoded = jwt.verify(token, SECRET) as TokenPayload;
    if (decoded.type !== expectedType) return null;
    if (!decoded.jti) return null;
    if (await isBlacklisted(decoded.jti)) return null;
    if (await isBlacklisted(`session:${decoded.sessionId}`)) return null;
    const active = await getActiveSession(decoded.phoneHash);
    if (!active || active !== decoded.sessionId) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function logoutSession(phoneHash: string, sessionId: string): Promise<void> {
  await addBlacklist(`session:${sessionId}`, Date.now() + REFRESH_TTL_MS);
  const active = await getActiveSession(phoneHash);
  if (active === sessionId) await deleteActiveSession(phoneHash);
}

export async function refreshAccessToken(refreshToken: string): Promise<IssueResult | null> {
  const decoded = await verifyToken(refreshToken, "refresh");
  if (!decoded) return null;

  const exp = decoded.exp ? decoded.exp * 1000 : Date.now() + REFRESH_TTL_MS;
  await addBlacklist(decoded.jti, exp);

  const sessionId = decoded.sessionId;
  const phoneHash = decoded.phoneHash;
  const access = sign(phoneHash, sessionId, "access");
  const refresh = sign(phoneHash, sessionId, "refresh");
  const now = Date.now();

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessExpiresAt: now + ACCESS_TTL_MS,
    refreshExpiresAt: now + REFRESH_TTL_MS,
    sessionId,
  };
}
