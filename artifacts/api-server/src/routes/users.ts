import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const router = Router();

router.get("/role/:phone", async (req: Request, res: Response) => {
  const { phone } = req.params;

  return res.json({
    phone,
    role: "patient",
  });
});

router.get("/me/:phone", async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.phone, phone),
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json(user);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { phone, fullName } = req.body;

    if (!phone) {
      return res.status(400).json({
        message: "Phone is required",
      });
    }

    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.phone, phone),
    });

    if (!user) {
      const inserted = await db
        .insert(usersTable)
        .values({
          phone,
          fullName,
        })
        .returning();

      user = inserted[0];
    }

    return res.json(user);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.put("/profile/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, profileImageUrl } = req.body;

    const updated = await db
      .update(usersTable)
      .set({
        fullName,
        profileImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id))
      .returning();

    if (!updated[0]) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json(updated[0]);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

export default router;