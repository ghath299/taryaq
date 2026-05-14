import Anthropic from "@anthropic-ai/sdk";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

// ─── Claude drug recognition ──────────────────────────────────────────────────

interface ClaudeResult {
  name: string;
  manufacturer: string;
  usage: string;
  dosage: string;
  activeIngredient: string;
  sideEffects: string;
  confidence: number;
}

interface ClaudeOutcome {
  data: ClaudeResult | null;
  hardFail: boolean;
  failReason?: string;
  failType?: "not_medicine" | "unclear" | "ai_unavailable" | "invalid_response";
  objectType?: string;
  objectName?: string;
}

interface ImageAiResult {
  isMedicine?: boolean;
  objectType?: string;
  objectName?: string;
  friendlyMessage?: string;
  confidence?: number;
  reason?: string;
  medicine?: {
    name?: string;
    company?: string;
    manufacturer?: string;
    activeIngredient?: string;
    usage?: string;
    dosage?: string;
    sideEffects?: string;
  };
}

function detectMediaType(base64: string): "image/jpeg" | "image/webp" | "image/png" | "image/gif" {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("UklGR")) return "image/webp";
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("R0lGO")) return "image/gif";
  return "image/jpeg";
}

function extractJsonObject(text: string): string | null {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  return cleaned.slice(firstBrace, lastBrace + 1);
}

function buildFriendlyNonMedicineMessage(result: ImageAiResult): string {
  const type = (result.objectType || "شيء آخر").toLowerCase();
  const name = result.objectName?.trim();

  const arabicType = (() => {
    if (type.includes("phone") || type.includes("mobile") || type.includes("iphone")) return "تلفون";
    if (type.includes("car")) return "سيارة";
    if (type.includes("person") || type.includes("human")) return "شخص";
    if (type.includes("animal") || type.includes("cat") || type.includes("dog")) return "حيوان";
    if (type.includes("food") || type.includes("drink")) return "أكل أو مشروب";
    if (type.includes("laptop") || type.includes("computer")) return "حاسبة";
    return "شيء مو دواء";
  })();

  const objectLabel = name ? `${arabicType} (${name})` : arabicType;
  return `😄 حبيبي هاي الصورة تبين ${objectLabel}، مو علاج. صوّر علبة الدواء أو اكتب اسمه حتى أبحث لك مضبوط.`;
}

function isUsableMedicineResult(medicine?: ImageAiResult["medicine"]): boolean {
  if (!medicine?.name || medicine.name.trim().length < 2) return false;

  const joined = [medicine.name, medicine.company, medicine.activeIngredient, medicine.usage, medicine.dosage]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const fakeDefaults = ["panadol extra", "unknown", "اسم الدواء", "غير معروف"];
  return !fakeDefaults.some((term) => joined === term || joined.includes(`\"${term}\"`));
}

async function recognizeWithClaude(
  medicationName?: string,
  imageBase64?: string,
): Promise<ClaudeOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { data: null, hardFail: false, failType: "ai_unavailable", failReason: "ANTHROPIC_API_KEY not set" };

  try {
    logger.info(
      { hasMedName: !!medicationName, hasImage: !!imageBase64, imageBytes: imageBase64?.length ?? 0 },
      "calling Claude API",
    );

    const client = new Anthropic({ apiKey });
    let response: Anthropic.Message;

    if (imageBase64) {
      response = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1200,
        temperature: 0,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: detectMediaType(imageBase64), data: imageBase64 },
            },
            {
              type: "text",
              text: `أنت نظام ذكي داخل تطبيق صحي اسمه ترياق.

حلل الصورة بدقة وحدد هل تحتوي على دواء حقيقي واضح أم لا.

أرجع JSON فقط بدون Markdown وبدون شرح.

إذا كانت الصورة تحتوي على دواء واضح:
{
  "isMedicine": true,
  "objectType": "medicine",
  "objectName": "اسم الدواء الظاهر على العلبة أو الشريط",
  "friendlyMessage": "",
  "confidence": 0.0,
  "medicine": {
    "name": "اسم الدواء",
    "company": "الشركة المصنعة إن ظهرت أو غير معروف",
    "activeIngredient": "المادة الفعالة إن أمكن",
    "usage": "الاستخدام العام باختصار",
    "dosage": "اكتب: حسب وصف الطبيب إذا لم تكن الجرعة واضحة",
    "sideEffects": "أعراض جانبية شائعة باختصار"
  }
}

إذا كانت الصورة ليست دواء، مثل هاتف أو سيارة أو شخص أو طعام أو أي شيء آخر:
{
  "isMedicine": false,
  "objectType": "phone/car/person/animal/food/device/other",
  "objectName": "اسم الشيء إن أمكن مثل iPhone 8 Plus",
  "friendlyMessage": "رسالة عراقية لطيفة ومضحكة قليلاً، بدون إهانة، تخبر المستخدم أن الصورة ليست دواء وتطلب منه تصوير الدواء",
  "confidence": 0.0,
  "reason": "سبب القرار باختصار"
}

قواعد صارمة:
- لا تخترع اسم دواء إذا الصورة ليست دواء.
- لا تستخدم Panadol أو أي دواء افتراضي.
- إذا الصورة غير واضحة أو لا يظهر اسم الدواء، اجعل isMedicine=false واكتب رسالة تطلب صورة أوضح.
- confidence بين 0 و 1.
- إذا لم تكن متأكدًا أن الصورة دواء، اعتبرها ليست دواء.
- JSON فقط.`, 
            },
          ],
        }],
      });
    } else {
      response = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        temperature: 0,
        messages: [{
          role: "user",
          content: `تعرف على هذا الدواء وأعطني معلوماته بالعربي بصيغة JSON فقط بدون أي نص إضافي:
{
  "name": "اسم الدواء",
  "company": "الشركة المصنعة",
  "activeIngredient": "المادة الفعالة",
  "usage": "الاستخدام",
  "dosage": "الجرعة الموصى بها",
  "sideEffects": "الأعراض الجانبية الشائعة"
}
اسم الدواء: ${medicationName}`,
        }],
      });
    }

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    logger.info({ rawText: text.slice(0, 600) }, "Claude raw response");

    const jsonText = extractJsonObject(text);
    if (!jsonText) {
      logger.warn({ text: text.slice(0, 300), hasImage: !!imageBase64 }, "Claude response contained no JSON");
      return {
        data: null,
        hardFail: false,
        failType: imageBase64 ? "unclear" : "invalid_response",
        failReason: imageBase64
          ? "🤔 ما قدرت أفهم الصورة بشكل واضح. صوّر علبة الدواء من قريب وخلي الاسم واضح."
          : "no JSON in Claude response",
      };
    }

    const parsed = JSON.parse(jsonText) as ImageAiResult & {
      name?: string;
      company?: string;
      activeIngredient?: string;
      usage?: string;
      dosage?: string;
      sideEffects?: string;
    };

    if (imageBase64) {
      const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;

      if (!parsed.isMedicine) {
        const message = parsed.friendlyMessage?.trim() || buildFriendlyNonMedicineMessage(parsed);
        logger.info(
          { objectType: parsed.objectType, objectName: parsed.objectName, confidence, reason: parsed.reason },
          "image rejected as non-medicine",
        );
        return {
          data: null,
          hardFail: false,
          failType: confidence < 0.45 ? "unclear" : "not_medicine",
          failReason: message,
          objectType: parsed.objectType,
          objectName: parsed.objectName,
        };
      }

      if (confidence < 0.55 || !isUsableMedicineResult(parsed.medicine)) {
        logger.warn({ confidence, medicine: parsed.medicine }, "medicine image result is not reliable");
        return {
          data: null,
          hardFail: false,
          failType: "unclear",
          failReason: "🤔 الصورة قريبة من دواء، بس الاسم مو واضح كفاية. صوّر الواجهة من قريب وخلي الكتابة ظاهرة.",
        };
      }

      const med = parsed.medicine!;
      logger.info({ name: med.name, confidence }, "Claude image medicine recognition success");

      return {
        data: {
          name: med.name!.trim(),
          manufacturer: (med.company || med.manufacturer || "غير معروف").trim(),
          activeIngredient: med.activeIngredient?.trim() ?? "",
          usage: med.usage?.trim() ?? "",
          dosage: med.dosage?.trim() ?? "حسب وصف الطبيب",
          sideEffects: med.sideEffects?.trim() ?? "",
          confidence,
        },
        hardFail: false,
      };
    }

    logger.info({ name: parsed.name }, "Claude text recognition success");
    return {
      data: {
        name: parsed.name ?? medicationName ?? "Unknown",
        manufacturer: parsed.company ?? "Unknown",
        activeIngredient: parsed.activeIngredient ?? "",
        usage: parsed.usage ?? "",
        dosage: parsed.dosage ?? "",
        sideEffects: parsed.sideEffects ?? "",
        confidence: 0.97,
      },
      hardFail: false,
    };
  } catch (err: unknown) {
    const apiErr = err as { status?: number; message?: string };
    logger.error({ status: apiErr.status, message: apiErr.message }, "Claude recognition error");

    if (apiErr.status === 401) {
      return { data: null, hardFail: true, failReason: "مفتاح Claude غير صالح. يرجى تحديث المفتاح." };
    }
    return {
      data: null,
      hardFail: false,
      failType: imageBase64 ? "unclear" : "invalid_response",
      failReason: imageBase64
        ? "صار خلل مؤقت بالتعرف على الصورة. جرّب مرة ثانية أو ابحث باسم الدواء."
        : `Claude error ${apiErr.status ?? "unknown"}: ${apiErr.message ?? ""}`,
    };
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
      dosage: "قرص إلى قرصين كل 4-6 ساعات، بحد أقصى 8 أقراص يومياً",
      activeIngredient: "باراسيتامول 500 ملغ + كافيين 65 ملغ",
      sideEffects: "نادراً: طفح جلدي، اضطرابات هضمية",
    },

    augmentin: {
      manufacturer: "GSK",
      usage: "مضاد حيوي لعلاج الالتهابات البكتيرية",
      dosage: "قرص كل 12 ساعة بعد الطعام",
      activeIngredient: "Amoxicillin + Clavulanic Acid",
      sideEffects: "إسهال، غثيان، طفح جلدي",
    },

    panadol: {
      manufacturer: "Haleon",
      usage: "مسكن للألم وخافض للحرارة",
      dosage: "قرص كل 4-6 ساعات عند الحاجة",
      activeIngredient: "Paracetamol",
      sideEffects: "نادراً مشاكل كبد عند الجرعات العالية",
    },

    brufen: {
      manufacturer: "Abbott",
      usage: "مسكن ومضاد التهاب",
      dosage: "400mg بعد الطعام",
      activeIngredient: "Ibuprofen",
      sideEffects: "حرقة معدة، غثيان",
    },

    flagyl: {
      manufacturer: "Sanofi",
      usage: "مضاد للبكتيريا والطفيليات",
      dosage: "حسب وصف الطبيب",
      activeIngredient: "Metronidazole",
      sideEffects: "غثيان، طعم معدني بالفم",
    },
  };

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post("/search", async (req: Request, res: Response) => {
  const { medicationName, imageBase64 } = req.body as {
    medicationName?: string;
    imageBase64?: string;
  };

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

  const { data: claudeData, hardFail, failReason, failType, objectType, objectName } = await recognizeWithClaude(medicationName, cleanBase64);

  if (claudeData) {
    return res.json({ ...claudeData, medicationName: claudeData.name });
  }

  if (hardFail) {
    req.log.warn({ failReason }, "Claude hard fail — returning error to client");
    return res.status(503).json({
      error:  failReason ?? "مفتاح Claude غير صالح. يرجى تحديث المفتاح.",
      code:   "CLAUDE_AUTH_FAILED",
    });
  }

  if (cleanBase64) {
    req.log.warn(
      { failReason, failType, objectType, objectName },
      "Claude image recognition failed — returning friendly no-result response",
    );

    return res.json({
      success: false,
      type: failType ?? "not_medicine_or_unclear",
      objectType: objectType ?? null,
      objectName: objectName ?? null,
      funnyMessage:
        failReason ??
        "🤔 ما قدرت أتعرف على دواء واضح بالصورة. صوّر علبة العلاج من قريب أو اكتب اسمه.",
      actions: [
        { key: "retake", label: "إعادة التصوير" },
        { key: "search_by_name", label: "البحث بالاسم" },
        { key: "ask_pharmacist", label: "إرسال للصيدلي للمساعدة" },
      ],
    });
  }

  if (failReason) {
    req.log.warn({ failReason }, "Claude text soft fail — falling back to mock data for text only");
  } else {
    req.log.info("ANTHROPIC_API_KEY not set — using mock data for text only");
  }

  const key   = (medicationName ?? "").toLowerCase().replace(/[\s-]/g, "");
  const found = Object.keys(MOCK_DRUGS).find((k) => k !== "default" && key.includes(k));
  const info  = found ? MOCK_DRUGS[found] : MOCK_DRUGS.default;
  const name  = medicationName ?? "دواء غير محدد";

  return res.json({
    name,
    medicationName: name,
    manufacturer:     info.manufacturer,
    usage:            info.usage,
    dosage:           info.dosage,
    activeIngredient: info.activeIngredient,
    sideEffects:      info.sideEffects,
    confidence:       1.0,
    _source:          "mock-text-only",
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
      { id: "m1", medicationName: "Concor 5mg",    activeIngredient: "بيزوبرولول 5 ملغ",             dailyDoses: 1, pillsPerDose: 1, pillsInBox: 28, isChronic: true,  startDate: new Date(now.getTime() - 86400000 * 10).toISOString(), endDate: null,                                                 lastPharmacyName: "صيدلية النور",  daysLeft: null },
      { id: "m2", medicationName: "Augmentin 625", activeIngredient: "أموكسيسيلين + حمض كلافولانيك", dailyDoses: 2, pillsPerDose: 1, pillsInBox: 14, isChronic: false, startDate: new Date(now.getTime() - 86400000 * 5).toISOString(),  endDate: new Date(now.getTime() + 86400000 * 2).toISOString(), lastPharmacyName: "صيدلية الشفاء", daysLeft: 2 },
    ],
  });
});

export default router;