import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

// ─── Gemini drug recognition ──────────────────────────────────────────────────

async function recognizeWithGemini(
  medicationName?: string,
  imageBase64?: string,
): Promise<{
  name: string;
  manufacturer: string;
  usage: string;
  dosage: string;
  activeIngredient: string;
  sideEffects: string;
  confidence: number;
} | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const parts: object[] = [];

  if (imageBase64) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: imageBase64 } });
    parts.push({
      text: `Identify this medication from the image. Return ONLY a JSON object (no markdown, no code fences) with exactly these fields: name (full trade name in English), manufacturer (company name), usage (in Arabic, 1-2 sentences), dosage (in Arabic, clear timing and quantity), activeIngredient (in Arabic), sideEffects (in Arabic, brief). If unidentifiable, set name to "غير معروف".`,
    });
  } else {
    parts.push({
      text: `You are a licensed pharmacist. For the drug named "${medicationName}", return ONLY a JSON object (no markdown, no code fences) with exactly these fields: name (full trade name), manufacturer (company name), usage (in Arabic, 1-2 sentences), dosage (in Arabic, clear timing and quantity), activeIngredient (in Arabic), sideEffects (in Arabic, brief). Respond only with the JSON object.`,
    });
  }

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
      },
    );

    if (!resp.ok) {
      logger.warn({ status: resp.status }, "Gemini API returned error");
      return null;
    }

    const data = (await resp.json()) as {
      candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      name?: string;
      manufacturer?: string;
      usage?: string;
      dosage?: string;
      activeIngredient?: string;
      sideEffects?: string;
    };

    return {
      name: parsed.name ?? medicationName ?? "Unknown",
      manufacturer: parsed.manufacturer ?? "Unknown",
      usage: parsed.usage ?? "",
      dosage: parsed.dosage ?? "",
      activeIngredient: parsed.activeIngredient ?? "",
      sideEffects: parsed.sideEffects ?? "",
      confidence: imageBase64 ? 0.92 : 0.97,
    };
  } catch (err) {
    logger.error({ err }, "Gemini recognition failed");
    return null;
  }
}

// ─── OpenRouteService street routing ─────────────────────────────────────────

async function getStreetRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<{ latitude: number; longitude: number }[] | null> {
  const apiKey = process.env.OPENROUTE_API_KEY;
  if (!apiKey) return null;

  try {
    const resp = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey,
        },
        body: JSON.stringify({
          coordinates: [
            [fromLng, fromLat],
            [toLng, toLat],
          ],
        }),
      },
    );

    if (!resp.ok) {
      logger.warn({ status: resp.status }, "ORS routing error");
      return null;
    }

    const data = (await resp.json()) as {
      features?: Array<{ geometry: { coordinates: [number, number][] } }>;
    };

    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords) return null;

    // ORS returns [lng, lat] pairs — convert to {latitude, longitude}
    return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  } catch (err) {
    logger.error({ err }, "ORS routing failed");
    return null;
  }
}

// ─── Mock fallback data ───────────────────────────────────────────────────────

const MOCK_DRUGS: Record<
  string,
  {
    manufacturer: string;
    usage: string;
    dosage: string;
    activeIngredient: string;
    sideEffects: string;
  }
> = {
  default: {
    manufacturer: "GlaxoSmithKline",
    usage: "مسكن للألم وخافض للحرارة",
    dosage: "قرص إلى قرصين كل 4–6 ساعات، بحد أقصى 8 أقراص يومياً",
    activeIngredient: "باراسيتامول 500 ملغ + كافيين 65 ملغ",
    sideEffects: "نادراً: طفح جلدي، اضطرابات هضمية",
  },
  augmentin: {
    manufacturer: "GlaxoSmithKline",
    usage: "مضاد حيوي لعلاج الالتهابات البكتيرية في الجهاز التنفسي والجلد",
    dosage: "قرص كل 12 ساعة مع الطعام لمدة 7–10 أيام",
    activeIngredient: "أموكسيسيلين 500 ملغ + حمض كلافولانيك 125 ملغ",
    sideEffects: "نادراً: إسهال، غثيان، طفح جلدي",
  },
  nexium: {
    manufacturer: "AstraZeneca",
    usage: "لعلاج قرحة المعدة وارتجاع الحمض المعدي المريئي",
    dosage: "كبسولة واحدة يومياً قبل الأكل بـ 30 دقيقة",
    activeIngredient: "إيزوميبرازول 40 ملغ",
    sideEffects: "نادراً: صداع، إسهال، غثيان",
  },
  concor: {
    manufacturer: "Merck KGaA",
    usage: "لعلاج ارتفاع ضغط الدم وقصور القلب وذبحة الصدر",
    dosage: "قرص واحد يومياً في الصباح مع الماء",
    activeIngredient: "بيزوبرولول فومارات 5 ملغ",
    sideEffects: "نادراً: دوار، تعب، برودة الأطراف",
  },
};

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post("/search", async (req: Request, res: Response) => {
  const { medicationName, imageBase64 } = req.body as {
    medicationName?: string;
    imageBase64?: string;
  };

  if (!medicationName && !imageBase64) {
    return res.status(400).json({ message: "اسم الدواء أو صورته مطلوب" });
  }

  // Try Gemini first
  const geminiResult = await recognizeWithGemini(medicationName, imageBase64);
  if (geminiResult) {
    return res.json({ ...geminiResult, medicationName: geminiResult.name });
  }

  // Fall back to mock data
  const key = (medicationName ?? "").toLowerCase().replace(/[\s-]/g, "");
  const found = Object.keys(MOCK_DRUGS).find(
    (k) => k !== "default" && key.includes(k),
  );
  const info = found ? MOCK_DRUGS[found] : MOCK_DRUGS.default;
  const name = medicationName ?? "Panadol Extra";

  return res.json({
    name,
    medicationName: name,
    manufacturer: info.manufacturer,
    usage: info.usage,
    dosage: info.dosage,
    activeIngredient: info.activeIngredient,
    sideEffects: info.sideEffects,
    confidence: imageBase64 ? 0.92 : 1.0,
  });
});

router.post("/route", async (req: Request, res: Response) => {
  const { fromLat, fromLng, toLat, toLng } = req.body as {
    fromLat?: number;
    fromLng?: number;
    toLat?: number;
    toLng?: number;
  };

  if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
    return res
      .status(400)
      .json({ message: "إحداثيات البداية والنهاية مطلوبة" });
  }

  const coordinates = await getStreetRoute(fromLat, fromLng, toLat, toLng);
  if (!coordinates) {
    // Straight-line fallback so the UI always gets something
    return res.json({
      coordinates: [
        { latitude: fromLat, longitude: fromLng },
        { latitude: toLat, longitude: toLng },
      ],
      source: "straight-line",
    });
  }

  return res.json({ coordinates, source: "openrouteservice" });
});

router.post("/request", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as {
    medicationName?: string;
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
  const { requestId, reason } = req.body as {
    requestId?: string;
    reason?: string;
  };
  if (!requestId || !reason) {
    return res
      .status(400)
      .json({ message: "requestId وسبب الإلغاء مطلوبان" });
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
    pillsInBox?: number;
    startDate?: string;
    isChronic?: boolean;
    pharmacyId?: string;
  };

  if (!body.medicationName) {
    return res.status(400).json({ message: "اسم الدواء مطلوب" });
  }

  const boxPills = body.pillsInBox ?? 0;
  const perDay = (body.dailyDoses ?? 1) * (body.pillsPerDose ?? 1);
  const daysLeft = perDay > 0 ? Math.floor(boxPills / perDay) : 0;
  const start = body.startDate ? new Date(body.startDate) : new Date();
  const endDate = new Date(start.getTime() + daysLeft * 86400000);

  return res.status(201).json({
    id: `med-${Date.now()}`,
    medicationName: body.medicationName,
    dailyDoses: body.dailyDoses ?? 1,
    pillsPerDose: body.pillsPerDose ?? 1,
    pillsInBox: boxPills,
    isChronic: body.isChronic ?? false,
    startDate: start.toISOString(),
    endDate: body.isChronic ? null : endDate.toISOString(),
    daysSupply: daysLeft,
    message: "تم حفظ الدواء وسيتم تذكيرك قبل يوم من نفاده",
  });
});

router.get("/reminders", requireAuth, async (req: Request, res: Response) => {
  const tomorrow = new Date(Date.now() + 86400000);
  return res.json({
    reminders: [
      {
        id: "rem1",
        medicationName: "Panadol Extra",
        reminderDate: tomorrow.toISOString(),
        isSent: false,
        message: "سينتهي دواؤك غداً — هل تريد نفس الجرعة؟",
      },
    ],
  });
});

router.get("/my-medications", requireAuth, async (req: Request, res: Response) => {
  const now = new Date();
  return res.json({
    medications: [
      {
        id: "m1",
        medicationName: "Concor 5mg",
        activeIngredient: "بيزوبرولول 5 ملغ",
        dailyDoses: 1,
        pillsPerDose: 1,
        pillsInBox: 28,
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
        pillsInBox: 14,
        isChronic: false,
        startDate: new Date(now.getTime() - 86400000 * 5).toISOString(),
        endDate: new Date(now.getTime() + 86400000 * 2).toISOString(),
        lastPharmacyName: "صيدلية الشفاء",
        daysLeft: 2,
      },
    ],
  });
});

export default router;
