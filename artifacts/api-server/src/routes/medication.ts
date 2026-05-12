import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const MOCK_DRUGS: Record<string, { manufacturer: string; usage: string; dosage: string; activeIngredient: string }> = {
  default: {
    manufacturer: "GlaxoSmithKline",
    usage: "مسكن للألم وخافض للحرارة",
    dosage: "قرص إلى قرصين كل 4–6 ساعات، بحد أقصى 8 أقراص يومياً",
    activeIngredient: "باراسيتامول 500 ملغ + كافيين 65 ملغ",
  },
  augmentin: {
    manufacturer: "GlaxoSmithKline",
    usage: "مضاد حيوي لعلاج الالتهابات البكتيرية",
    dosage: "قرص كل 12 ساعة مع الطعام لمدة 7–10 أيام",
    activeIngredient: "أموكسيسيلين 500 ملغ + حمض كلافولانيك 125 ملغ",
  },
  nexium: {
    manufacturer: "AstraZeneca",
    usage: "لعلاج قرحة المعدة وارتجاع الحمض",
    dosage: "كبسولة واحدة يومياً قبل الأكل",
    activeIngredient: "إيزوميبرازول 40 ملغ",
  },
  concor: {
    manufacturer: "Merck",
    usage: "لعلاج ضغط الدم وأمراض القلب",
    dosage: "قرص واحد يومياً في الصباح",
    activeIngredient: "بيزوبرولول فومارات 5 ملغ",
  },
};

router.post("/search", async (req: Request, res: Response) => {
  const { medicationName, imageBase64 } = req.body as {
    medicationName?: string;
    imageBase64?: string;
  };

  if (!medicationName && !imageBase64) {
    return res.status(400).json({ message: "اسم الدواء أو صورته مطلوب" });
  }

  const key = (medicationName ?? "").toLowerCase().replace(/\s+/g, "");
  const found = Object.keys(MOCK_DRUGS).find((k) => key.includes(k));
  const info = found ? MOCK_DRUGS[found] : MOCK_DRUGS.default;
  const name = medicationName ?? "Panadol Extra";

  return res.json({
    medicationName: name,
    manufacturer: info.manufacturer,
    usage: info.usage,
    dosage: info.dosage,
    activeIngredient: info.activeIngredient,
    sideEffects: "نادراً: طفح جلدي، غثيان، دوار",
    confidence: imageBase64 ? 0.92 : 1.0,
  });
});

router.post("/request", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as {
    medicationName?: string;
    medicationImage?: string;
    searchRadius?: number;
    patientLat?: number;
    patientLng?: number;
  };

  if (!body.medicationName) {
    return res.status(400).json({ message: "اسم الدواء مطلوب" });
  }

  return res.status(201).json({
    id: `req-${Date.now()}`,
    status: "searching",
    message: "تم إرسال طلب البحث للصيدليات القريبة",
    notifiedCount: 4,
  });
});

router.put("/confirm-receipt", requireAuth, async (req: Request, res: Response) => {
  const { requestId } = req.body as { requestId?: string };
  if (!requestId) return res.status(400).json({ message: "requestId مطلوب" });
  return res.json({ message: "شكراً! تم تأكيد الاستلام", requestId });
});

router.put("/cancel", requireAuth, async (req: Request, res: Response) => {
  const { requestId, reason } = req.body as { requestId?: string; reason?: string };
  if (!requestId || !reason) {
    return res.status(400).json({ message: "requestId وسبب الإلغاء مطلوبان" });
  }
  return res.json({ message: "تم إلغاء الطلب", requestId });
});

router.get("/history", requireAuth, async (req: Request, res: Response) => {
  const now = Date.now();
  const history = [
    {
      id: "r1",
      medicationName: "Panadol Extra",
      pharmacyName: "صيدلية الشفاء",
      status: "completed",
      price: 2500,
      createdAt: new Date(now - 86400000 * 2).toISOString(),
    },
    {
      id: "r2",
      medicationName: "Augmentin 625",
      pharmacyName: "صيدلية النور",
      status: "completed",
      price: 7500,
      createdAt: new Date(now - 86400000 * 7).toISOString(),
    },
    {
      id: "r3",
      medicationName: "Nexium 40mg",
      pharmacyName: "صيدلية الحياة",
      status: "cancelled",
      price: null,
      createdAt: new Date(now - 86400000 * 14).toISOString(),
    },
    {
      id: "r4",
      medicationName: "Concor 5mg",
      pharmacyName: "صيدلية الأمل",
      status: "completed",
      price: 4000,
      createdAt: new Date(now - 86400000 * 21).toISOString(),
    },
  ];
  return res.json({ history });
});

router.post("/save", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as {
    medicationName?: string;
    dailyDoses?: number;
    pillsPerDose?: number;
    totalPills?: number;
    startDate?: string;
    isChronic?: boolean;
    pharmacyId?: string;
  };

  if (!body.medicationName) {
    return res.status(400).json({ message: "اسم الدواء مطلوب" });
  }

  const total = body.totalPills ?? 0;
  const perDay = (body.dailyDoses ?? 1) * (body.pillsPerDose ?? 1);
  const daysLeft = perDay > 0 ? Math.floor(total / perDay) : 0;
  const start = body.startDate ? new Date(body.startDate) : new Date();
  const endDate = new Date(start.getTime() + daysLeft * 86400000);

  return res.status(201).json({
    id: `med-${Date.now()}`,
    medicationName: body.medicationName,
    dailyDoses: body.dailyDoses ?? 1,
    pillsPerDose: body.pillsPerDose ?? 1,
    totalPills: total,
    isChronic: body.isChronic ?? false,
    startDate: start.toISOString(),
    endDate: body.isChronic ? null : endDate.toISOString(),
    daysSupply: daysLeft,
    message: "تم حفظ الدواء وسيتم تذكيرك قبل يوم من نفاده",
  });
});

router.get("/reminders", requireAuth, async (req: Request, res: Response) => {
  const tomorrow = new Date(Date.now() + 86400000);
  const reminders = [
    {
      id: "rem1",
      medicationName: "Panadol Extra",
      reminderDate: tomorrow.toISOString(),
      isSent: false,
      message: "سينتهي دواؤك غداً — هل تريد نفس الجرعة؟",
    },
  ];
  return res.json({ reminders });
});

router.get("/my-medications", requireAuth, async (req: Request, res: Response) => {
  const now = new Date();
  const medications = [
    {
      id: "m1",
      medicationName: "Concor 5mg",
      activeIngredient: "بيزوبرولول 5 ملغ",
      dailyDoses: 1,
      pillsPerDose: 1,
      totalPills: 28,
      isChronic: true,
      startDate: new Date(now.getTime() - 86400000 * 10).toISOString(),
      endDate: null,
      lastPharmacyName: "صيدلية النور",
      daysLeft: null,
    },
    {
      id: "m2",
      medicationName: "Augmentin 625",
      activeIngredient: "أموكسيسيلين + حمض كلافولانيك",
      dailyDoses: 2,
      pillsPerDose: 1,
      totalPills: 14,
      isChronic: false,
      startDate: new Date(now.getTime() - 86400000 * 5).toISOString(),
      endDate: new Date(now.getTime() + 86400000 * 2).toISOString(),
      lastPharmacyName: "صيدلية الشفاء",
      daysLeft: 2,
    },
  ];
  return res.json({ medications });
});

export default router;
