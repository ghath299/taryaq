import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

// ─── Gemini drug recognition ──────────────────────────────────────────────────

interface GeminiResult {
  name: string;
  manufacturer: string;
  usage: string;
  dosage: string;
  activeIngredient: string;
  sideEffects: string;
  confidence: number;
}

// hardFail = true  → key is invalid/unauthorised  → show error to user
// hardFail = false → quota exceeded / network / parse → fall back to mock silently
interface GeminiOutcome {
  data:      GeminiResult | null;
  hardFail:  boolean;
  failReason?: string;
}

async function recognizeWithGemini(
  medicationName?: string,
  imageBase64?: string,
): Promise<GeminiOutcome> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { data: null, hardFail: false };

  const parts: object[] = [];

  if (imageBase64) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: imageBase64 } });
    parts.push({
      text: "Identify this medication from the image. Return ONLY a JSON object (no markdown, no code fences) with exactly these fields: name (full trade name in English), manufacturer (company name), usage (in Arabic, 1-2 sentences), dosage (in Arabic, clear timing and quantity), activeIngredient (in Arabic), sideEffects (in Arabic, brief). If unidentifiable, set name to \"غير معروف\".",
    });
  } else {
    parts.push({
      text: `You are a licensed pharmacist. For the drug named "${medicationName}", return ONLY a JSON object (no markdown, no code fences) with exactly these fields: name (full trade name), manufacturer (company name), usage (in Arabic, 1-2 sentences), dosage (in Arabic, clear timing and quantity), activeIngredient (in Arabic), sideEffects (in Arabic, brief). Respond only with the JSON object.`,
    });
  }

  try {
    logger.info(
      { hasMedName: !!medicationName, hasImage: !!imageBase64, imageBytes: imageBase64?.length ?? 0 },
      "calling Gemini API",
    );

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ contents: [{ parts }] }),
      },
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      logger.error({ status: resp.status, body: errText.slice(0, 200) }, "Gemini API HTTP error");

      // 401 / 403 = invalid or revoked key → hard fail (user must fix the key)
      if (resp.status === 401 || resp.status === 403) {
        return { data: null, hardFail: true, failReason: "مفتاح Gemini غير صالح أو منتهي الصلاحية. يرجى تحديث المفتاح." };
      }
      // 429 = quota exceeded → soft fail → use mock
      return { data: null, hardFail: false, failReason: `Gemini HTTP ${resp.status}` };
    }

    const geminiData = (await resp.json()) as {
      candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
      error?: { message: string };
    };

    if (geminiData.error) {
      logger.error({ geminiError: geminiData.error.message }, "Gemini API returned error object");
      return { data: null, hardFail: false, failReason: geminiData.error.message };
    }

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    logger.info({ rawText: text.slice(0, 300) }, "Gemini raw response");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn({ text: text.slice(0, 200) }, "Gemini response contained no JSON");
      return { data: null, hardFail: false, failReason: "no JSON in Gemini response" };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      name?: string;
      manufacturer?: string;
      usage?: string;
      dosage?: string;
      activeIngredient?: string;
      sideEffects?: string;
    };

    logger.info({ name: parsed.name }, "Gemini recognition success");

    return {
      data: {
        name:             parsed.name ?? medicationName ?? "Unknown",
        manufacturer:     parsed.manufacturer ?? "Unknown",
        usage:            parsed.usage ?? "",
        dosage:           parsed.dosage ?? "",
        activeIngredient: parsed.activeIngredient ?? "",
        sideEffects:      parsed.sideEffects ?? "",
        confidence:       imageBase64 ? 0.92 : 0.97,
      },
      hardFail: false,
    };
  } catch (err) {
    logger.error({ err }, "Gemini recognition exception");
    return { data: null, hardFail: false, failReason: "network/exception" };
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
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: apiKey },
        body:    JSON.stringify({ coordinates: [[fromLng, fromLat], [toLng, toLat]] }),
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

    // ORS returns [lng, lat] — convert to {latitude, longitude}
    return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  } catch (err) {
    logger.error({ err }, "ORS routing failed");
    return null;
  }
}

// ─── Mock fallback data ───────────────────────────────────────────────────────

const MOCK_DRUGS: Record<
  string,
  { manufacturer: string; usage: string; dosage: string; activeIngredient: string; sideEffects: string }
> = {
  default: {
    manufacturer:     "GlaxoSmithKline",
    usage:            "مسكن للألم وخافض للحرارة",
    dosage:           "قرص إلى قرصين كل 4–6 ساعات، بحد أقصى 8 أقراص يومياً",
    activeIngredient: "باراسيتامول 500 ملغ + كافيين 65 ملغ",
    sideEffects:      "نادراً: طفح جلدي، اضطرابات هضمية",
  },
  augmentin: {
    manufacturer:     "GlaxoSmithKline",
    usage:            "مضاد حيوي لعلاج الالتهابات البكتيرية في الجهاز التنفسي والجلد",
    dosage:           "قرص كل 12 ساعة مع الطعام لمدة 7–10 أيام",
    activeIngredient: "أموكسيسيلين 500 ملغ + حمض كلافولانيك 125 ملغ",
    sideEffects:      "نادراً: إسهال، غثيان، طفح جلدي",
  },
  nexium: {
    manufacturer:     "AstraZeneca",
    usage:            "لعلاج قرحة المعدة وارتجاع الحمض المعدي المريئي",
    dosage:           "كبسولة واحدة يومياً قبل الأكل بـ 30 دقيقة",
    activeIngredient: "إيزوميبرازول 40 ملغ",
    sideEffects:      "نادراً: صداع، إسهال، غثيان",
  },
  concor: {
    manufacturer:     "Merck KGaA",
    usage:            "لعلاج ارتفاع ضغط الدم وقصور القلب وذبحة الصدر",
    dosage:           "قرص واحد يومياً في الصباح مع الماء",
    activeIngredient: "بيزوبرولول فومارات 5 ملغ",
    sideEffects:      "نادراً: دوار، تعب، برودة الأطراف",
  },
};

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post("/search", async (req: Request, res: Response) => {
  const { medicationName, imageBase64 } = req.body as {
    medicationName?: string;
    imageBase64?: string;
  };

  // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,")
  const cleanBase64 = imageBase64
    ? imageBase64.replace(/^data:[^;]+;base64,/, "")
    : undefined;

  req.log.info(
    {
      hasMedName:   !!medicationName,
      medicationName: medicationName?.slice(0, 60),
      hasImage:     !!cleanBase64,
      imageByteLen: cleanBase64?.length ?? 0,
    },
    "POST /api/medication/search",
  );

  if (!medicationName && !cleanBase64) {
    return res.status(400).json({ message: "اسم الدواء أو صورته مطلوب" });
  }

  const { data: geminiData, hardFail, failReason } = await recognizeWithGemini(medicationName, cleanBase64);

  if (geminiData) {
    return res.json({ ...geminiData, medicationName: geminiData.name });
  }

  if (hardFail) {
    // Invalid / revoked key — user must fix this, don't mask with mock data
    req.log.warn({ failReason }, "Gemini hard fail — returning error to client");
    return res.status(503).json({
      error:  failReason ?? "مفتاح Gemini غير صالح. يرجى تحديث المفتاح.",
      code:   "GEMINI_AUTH_FAILED",
    });
  }

  // Soft fail (quota exceeded, network, no key) — fall back to mock data transparently
  if (failReason) {
    req.log.warn({ failReason }, "Gemini soft fail — falling back to mock data");
  } else {
    req.log.info("GEMINI_API_KEY not set — using mock data");
  }
  const key   = (medicationName ?? "").toLowerCase().replace(/[\s-]/g, "");
  const found = Object.keys(MOCK_DRUGS).find((k) => k !== "default" && key.includes(k));
  const info  = found ? MOCK_DRUGS[found] : MOCK_DRUGS.default;
  const name  = medicationName ?? "Panadol Extra";

  return res.json({
    name,
    medicationName: name,
    manufacturer:     info.manufacturer,
    usage:            info.usage,
    dosage:           info.dosage,
    activeIngredient: info.activeIngredient,
    sideEffects:      info.sideEffects,
    confidence:       1.0,
    _source:          "mock",
  });
});

router.post("/route", async (req: Request, res: Response) => {
  const { fromLat, fromLng, toLat, toLng } = req.body as {
    fromLat?: number; fromLng?: number; toLat?: number; toLng?: number;
  };

  if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
    return res.status(400).json({ message: "إحداثيات البداية والنهاية مطلوبة" });
  }

  const coordinates = await getStreetRoute(fromLat, fromLng, toLat, toLng);
  if (!coordinates) {
    return res.json({
      coordinates: [
        { latitude: fromLat, longitude: fromLng },
        { latitude: toLat,   longitude: toLng   },
      ],
      source: "straight-line",
    });
  }
  return res.json({ coordinates, source: "openrouteservice" });
});

router.post("/request", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as { medicationName?: string };
  if (!body.medicationName) return res.status(400).json({ message: "اسم الدواء مطلوب" });
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
  if (!requestId || !reason) return res.status(400).json({ message: "requestId وسبب الإلغاء مطلوبان" });
  return res.json({ message: "تم إلغاء الطلب", requestId });
});

router.get("/history", requireAuth, async (req: Request, res: Response) => {
  const now = Date.now();
  return res.json({
    history: [
      { id: "r1", medicationName: "Panadol Extra",  pharmacyName: "صيدلية الشفاء", status: "completed", price: 2500, createdAt: new Date(now - 86400000 * 2).toISOString() },
      { id: "r2", medicationName: "Augmentin 625",  pharmacyName: "صيدلية النور",  status: "completed", price: 7500, createdAt: new Date(now - 86400000 * 7).toISOString() },
      { id: "r3", medicationName: "Nexium 40mg",    pharmacyName: "صيدلية الحياة", status: "cancelled", price: null, createdAt: new Date(now - 86400000 * 14).toISOString() },
      { id: "r4", medicationName: "Concor 5mg",     pharmacyName: "صيدلية الأمل",  status: "completed", price: 4000, createdAt: new Date(now - 86400000 * 21).toISOString() },
    ],
  });
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

  if (!body.medicationName) return res.status(400).json({ message: "اسم الدواء مطلوب" });

  const boxPills = body.pillsInBox ?? 0;
  const perDay   = (body.dailyDoses ?? 1) * (body.pillsPerDose ?? 1);
  const daysLeft = perDay > 0 ? Math.floor(boxPills / perDay) : 0;
  const start    = body.startDate ? new Date(body.startDate) : new Date();
  const endDate  = new Date(start.getTime() + daysLeft * 86400000);

  return res.status(201).json({
    id: `med-${Date.now()}`,
    medicationName: body.medicationName,
    dailyDoses:  body.dailyDoses ?? 1,
    pillsPerDose: body.pillsPerDose ?? 1,
    pillsInBox:  boxPills,
    isChronic:   body.isChronic ?? false,
    startDate:   start.toISOString(),
    endDate:     body.isChronic ? null : endDate.toISOString(),
    daysSupply:  daysLeft,
    message: "تم حفظ الدواء وسيتم تذكيرك قبل يوم من نفاده",
  });
});

router.get("/reminders", requireAuth, async (_req: Request, res: Response) => {
  const tomorrow = new Date(Date.now() + 86400000);
  return res.json({
    reminders: [
      { id: "rem1", medicationName: "Panadol Extra", reminderDate: tomorrow.toISOString(), isSent: false, message: "سينتهي دواؤك غداً — هل تريد نفس الجرعة؟" },
    ],
  });
});

router.get("/my-medications", requireAuth, async (_req: Request, res: Response) => {
  const now = new Date();
  return res.json({
    medications: [
      { id: "m1", medicationName: "Concor 5mg",    activeIngredient: "بيزوبرولول 5 ملغ",                     dailyDoses: 1, pillsPerDose: 1, pillsInBox: 28, isChronic: true,  startDate: new Date(now.getTime() - 86400000 * 10).toISOString(), endDate: null,                                                   lastPharmacyName: "صيدلية النور",  daysLeft: null },
      { id: "m2", medicationName: "Augmentin 625", activeIngredient: "أموكسيسيلين + حمض كلافولانيك",         dailyDoses: 2, pillsPerDose: 1, pillsInBox: 14, isChronic: false, startDate: new Date(now.getTime() - 86400000 * 5).toISOString(),  endDate: new Date(now.getTime() + 86400000 * 2).toISOString(),   lastPharmacyName: "صيدلية الشفاء", daysLeft: 2 },
    ],
  });
});

export default router;
