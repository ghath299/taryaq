import type { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "../lib/jwt";

export interface AuthedRequest extends Request {
  auth?: TokenPayload;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "غير مصرّح" });
    return;
  }
  const token = header.slice(7).trim();
  const payload = await verifyToken(token, "access");
  if (!payload) {
    res.status(401).json({ message: "الجلسة منتهية أو غير صالحة" });
    return;
  }
  (req as AuthedRequest).auth = payload;
  next();
}
