import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { type AuthedRequest } from "../middlewares/requireAuth";
import { hashPhone } from "../lib/jwt";

const router = Router();

router.get("/role/:phone", async (req: Request, res: Response) => {
  const { phone } = req.params;
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.phone, phone as string),
    });
    return res.json({ phone, role: user?.role ?? "patient" });
  } catch {
    return res.json({ phone, role: "patient" });
  }
});

router.get("/me/:phone", async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.phone, phone as string),
    });
    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }
    return res.json(user);
  } catch (error) {
    req.log.error({ error }, "Failed to fetch user profile");
    return res.status(500).json({ message: "خطأ في الخادم" });
  }
});

router.post("/register", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as { phone?: string; fullName?: string };
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";

  if (!phone || !fullName) {
    return res.status(400).json({ message: "phone و fullName مطلوبان" });
  }

  try {
    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.phone, phone),
    });

    if (existing) {
      const updated = await db
        .update(usersTable)
        .set({ fullName, updatedAt: new Date() })
        .where(eq(usersTable.phone, phone))
        .returning();
      return res.json(updated[0]);
    }

    const inserted = await db
      .insert(usersTable)
      .values({ phone, fullName })
      .returning();
    return res.json(inserted[0]);
  } catch (error) {
    req.log.error({ error }, "Failed to register user");
    return res.status(500).json({ message: "خطأ في الخادم" });
  }
});

router.put("/profile/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const auth = (req as AuthedRequest).auth!;
    const body = req.body as { fullName?: string; profileImageUrl?: string | null };

    const existingUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, id as string),
    });

    if (!existingUser) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }

    if (hashPhone(existingUser.phone) !== auth.phoneHash) {
      return res.status(403).json({ message: "غير مصرّح بتعديل هذا الحساب" });
    }

    const updateData: {
      fullName?: string;
      profileImageUrl?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (typeof body.fullName === "string" && body.fullName.trim()) {
      updateData.fullName = body.fullName.trim();
    }
    if (typeof body.profileImageUrl !== "undefined") {
      updateData.profileImageUrl = body.profileImageUrl ?? null;
    }

    const updated = await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, id as string))
      .returning();

    return res.json(updated[0]);
  } catch (error) {
    req.log.error({ error }, "Failed to update user profile");
    return res.status(500).json({ message: "خطأ في الخادم" });
  }
});

export default router;
