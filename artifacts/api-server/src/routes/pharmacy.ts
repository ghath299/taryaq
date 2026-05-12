import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
  const body = req.body as {
    name?: string;
    ownerName?: string;
    phone?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };

  if (!body.name || !body.ownerName || !body.phone) {
    return res.status(400).json({ message: "الاسم واسم المالك والهاتف مطلوبة" });
  }

  return res.status(201).json({
    message: "تم إرسال طلب التسجيل، سيتم مراجعته خلال 24 ساعة",
    id: `pharmacy-${Date.now()}`,
  });
});

router.put("/availability", requireAuth, async (req: Request, res: Response) => {
  const { isAvailable } = req.body as { isAvailable?: boolean };
  if (typeof isAvailable !== "boolean") {
    return res.status(400).json({ message: "isAvailable مطلوب (true/false)" });
  }
  return res.json({
    isAvailable,
    message: isAvailable ? "أنت متاح الآن لاستقبال الطلبات" : "تم تعطيل الاستقبال",
  });
});

router.get("/nearby", async (req: Request, res: Response) => {
  const pharmacies = [
    {
      id: "p1",
      name: "صيدلية الشفاء",
      address: "شارع فلسطين، مقابل جامع الزهراء",
      hours: "مفتوحة 24 ساعة",
      distanceM: 210,
      isAvailable: true,
      rating: 4.8,
      totalRatings: 124,
      latitude: 33.3152,
      longitude: 44.3661,
      x: 0.20,
      y: 0.28,
    },
    {
      id: "p2",
      name: "صيدلية الحياة",
      address: "شارع الصناعة، قرب الدفاع المدني",
      hours: "مفتوحة حتى 11 م",
      distanceM: 340,
      isAvailable: true,
      rating: 4.5,
      totalRatings: 87,
      latitude: 33.3160,
      longitude: 44.3690,
      x: 0.78,
      y: 0.22,
    },
    {
      id: "p3",
      name: "صيدلية الأمل",
      address: "شارع النضال، مقابل مطعم الخليج",
      hours: "مفتوحة حتى 12 ص",
      distanceM: 430,
      isAvailable: false,
      rating: 4.2,
      totalRatings: 62,
      latitude: 33.3140,
      longitude: 44.3640,
      x: 0.30,
      y: 0.78,
    },
    {
      id: "p4",
      name: "صيدلية النور",
      address: "حي الكرادة، قرب البريد",
      hours: "مفتوحة حتى 10 م",
      distanceM: 480,
      isAvailable: true,
      rating: 4.7,
      totalRatings: 198,
      latitude: 33.3170,
      longitude: 44.3620,
      x: 0.72,
      y: 0.74,
    },
    {
      id: "p5",
      name: "صيدلية البركة",
      address: "شارع الرشيد، قرب المصرف",
      hours: "مفتوحة حتى 9 م",
      distanceM: 490,
      isAvailable: true,
      rating: 4.3,
      totalRatings: 45,
      latitude: 33.3135,
      longitude: 44.3700,
      x: 0.50,
      y: 0.12,
    },
  ];
  return res.json({ pharmacies });
});

router.post("/respond", requireAuth, async (req: Request, res: Response) => {
  const { requestId, status } = req.body as { requestId?: string; status?: string };
  if (!requestId || !["available", "unavailable"].includes(status ?? "")) {
    return res.status(400).json({ message: "requestId والحالة (available/unavailable) مطلوبان" });
  }
  return res.json({ message: "تم تسجيل ردّك بنجاح", requestId, status });
});

router.put("/deliver", requireAuth, async (req: Request, res: Response) => {
  const { requestId } = req.body as { requestId?: string };
  if (!requestId) return res.status(400).json({ message: "requestId مطلوب" });
  return res.json({
    message: "تم تسجيل التسليم، في انتظار تأكيد المريض",
    requestId,
  });
});

export default router;
