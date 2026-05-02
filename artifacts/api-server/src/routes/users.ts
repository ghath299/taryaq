import { Router, type Request, type Response } from "express";

const router = Router();

router.get("/role/:phone", (req: Request, res: Response) => {
  const { phone } = req.params;
  res.json({ phone, role: "patient" });
});

export default router;
