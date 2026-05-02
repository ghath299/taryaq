/**
 * تكامل الدفع عبر بطاقة Qi Card.
 *
 * هذا الملف يحتوي إعدادات الاتصال بـ API الخاصة بشركة Qi Card،
 * ودوال إجراء الدفع، التحقق من حالة الدفعة، والاسترداد.
 *
 * حالياً يعمل في وضع التجربة (isTestMode = true) — يحاكي الدفع دون
 * أي اتصال شبكي. عند الحصول على حساب تاجر فعلي من Qi Card:
 *   1. ضع merchantId و apiKey و secretKey
 *   2. عدّل isTestMode إلى false
 *   3. تأكد من apiUrl مطابق للوثائق الرسمية
 * كل الواجهة وحفظ Firebase سيستمر بالعمل دون أي تعديل إضافي.
 */

export interface QiCardConfig {
  merchantId: string;
  apiKey: string;
  secretKey: string;
  apiUrl: string;
  isTestMode: boolean;
  /** عدد محاولات الدفع المسموح بها لكل حجز قبل الحجب المؤقت */
  maxAttempts: number;
}

export const QI_CARD_CONFIG: QiCardConfig = {
  merchantId: "MERCHANT_ID_HERE",
  apiKey: "API_KEY_HERE",
  secretKey: "SECRET_KEY_HERE",
  apiUrl: "https://api.qicard.iq/v1",
  isTestMode: true,
  maxAttempts: 3,
};

/** أرقام بطاقات وضع التجربة */
export const TEST_CARDS = {
  /** يُرجع نجاح فوري */
  SUCCESS: "4444444444444444",
  /** يُرجع فشل (للاختبار) */
  FAILURE: "4444444444440000",
};

export interface ProcessPaymentParams {
  amount: number;
  currency?: "IQD";
  cardNumber: string;
  expiryDate: string; // MM/YY
  cvv: string;
  patientId: string;
  bookingId: string;
  doctorId: string;
  clinicId?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  message: string;
  errorCode?: string;
  rawResponse?: unknown;
}

/* ----------------------------- Rate limiting ----------------------------- */
// عدّاد محلي بسيط لمحاولات الدفع لكل حجز.
// في الإنتاج يُستحسن نقل هذا الفحص إلى الخادم لأنه يمكن تجاوزه على الجهاز.
const attempts = new Map<string, { count: number; firstAt: number }>();
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10 دقائق

function recordAttempt(bookingId: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const entry = attempts.get(bookingId);
  if (!entry || now - entry.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.set(bookingId, { count: 1, firstAt: now });
    return { allowed: true, remaining: QI_CARD_CONFIG.maxAttempts - 1 };
  }
  if (entry.count >= QI_CARD_CONFIG.maxAttempts) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return {
    allowed: true,
    remaining: QI_CARD_CONFIG.maxAttempts - entry.count,
  };
}

export function resetPaymentAttempts(bookingId: string) {
  attempts.delete(bookingId);
}

/* --------------------------- processPayment ------------------------------ */
/**
 * إجراء دفعة جديدة عبر Qi Card.
 * في وضع التجربة:
 *   - رقم 4444 4444 4444 4444 → نجاح
 *   - رقم 4444 4444 4444 0000 → فشل
 *   - أي رقم آخر → نجاح (لتسهيل الاختبار)
 */
export async function processPayment(
  params: ProcessPaymentParams,
): Promise<PaymentResult> {
  const cleanCard = params.cardNumber.replace(/\s/g, "");

  // فحص الحد الأقصى للمحاولات
  const limit = recordAttempt(params.bookingId);
  if (!limit.allowed) {
    return {
      success: false,
      errorCode: "RATE_LIMITED",
      message:
        "تجاوزت الحد الأقصى لمحاولات الدفع. يرجى المحاولة بعد 10 دقائق.",
    };
  }

  if (QI_CARD_CONFIG.isTestMode) {
    // محاكاة تأخير الشبكة
    await new Promise((r) => setTimeout(r, 1500));
    if (cleanCard === TEST_CARDS.FAILURE) {
      return {
        success: false,
        errorCode: "TEST_DECLINED",
        message: "تم رفض البطاقة (وضع تجريبي). جرّب رقماً آخر.",
      };
    }
    return {
      success: true,
      transactionId: "TEST_" + Date.now(),
      message: "تم الدفع بنجاح (وضع تجريبي)",
    };
  }

  try {
    const response = await fetch(`${QI_CARD_CONFIG.apiUrl}/payment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${QI_CARD_CONFIG.apiKey}`,
        "Merchant-ID": QI_CARD_CONFIG.merchantId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency || "IQD",
        card_number: cleanCard,
        expiry_date: params.expiryDate,
        cvv: params.cvv,
        merchant_id: QI_CARD_CONFIG.merchantId,
        reference_id: params.bookingId,
        patient_id: params.patientId,
        doctor_id: params.doctorId,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        errorCode: data?.error_code || "API_ERROR",
        message: data?.message || "فشلت عملية الدفع",
        rawResponse: data,
      };
    }
    return {
      success: true,
      transactionId: data.transaction_id || data.transactionId,
      message: data.message || "تم الدفع بنجاح",
      rawResponse: data,
    };
  } catch (e: any) {
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      message: e?.message || "تعذّر الاتصال بخدمة الدفع",
    };
  }
}

/* --------------------------- verifyPayment ------------------------------- */
/**
 * التحقق من حالة دفعة سابقة عبر رقم المعاملة.
 * في وضع التجربة يُرجع دائماً paid للـ TEST_*.
 */
export async function verifyPayment(transactionId: string): Promise<{
  status: "paid" | "pending" | "failed" | "refunded" | "unknown";
  amount?: number;
  rawResponse?: unknown;
}> {
  if (QI_CARD_CONFIG.isTestMode) {
    await new Promise((r) => setTimeout(r, 600));
    if (transactionId.startsWith("TEST_")) return { status: "paid" };
    return { status: "unknown" };
  }
  try {
    const response = await fetch(
      `${QI_CARD_CONFIG.apiUrl}/payment/${encodeURIComponent(transactionId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${QI_CARD_CONFIG.apiKey}`,
          "Merchant-ID": QI_CARD_CONFIG.merchantId,
        },
      },
    );
    const data = await response.json();
    if (!response.ok) return { status: "unknown", rawResponse: data };
    return {
      status: (data.status as any) || "unknown",
      amount: data.amount,
      rawResponse: data,
    };
  } catch {
    return { status: "unknown" };
  }
}

/* --------------------------- refundPayment ------------------------------- */
/**
 * إصدار استرداد لدفعة موجودة.
 * في وضع التجربة يُرجع دائماً نجاح.
 */
export async function refundPayment(params: {
  transactionId: string;
  amount?: number;
  reason?: string;
}): Promise<PaymentResult> {
  if (QI_CARD_CONFIG.isTestMode) {
    await new Promise((r) => setTimeout(r, 800));
    return {
      success: true,
      transactionId: "REFUND_" + Date.now(),
      message: "تم الاسترداد بنجاح (وضع تجريبي)",
    };
  }
  try {
    const response = await fetch(`${QI_CARD_CONFIG.apiUrl}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${QI_CARD_CONFIG.apiKey}`,
        "Merchant-ID": QI_CARD_CONFIG.merchantId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction_id: params.transactionId,
        amount: params.amount,
        reason: params.reason,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        errorCode: data?.error_code || "REFUND_FAILED",
        message: data?.message || "فشل الاسترداد",
        rawResponse: data,
      };
    }
    return {
      success: true,
      transactionId: data.refund_id || data.transaction_id,
      message: data.message || "تم الاسترداد بنجاح",
      rawResponse: data,
    };
  } catch (e: any) {
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      message: e?.message || "تعذّر الاتصال بخدمة الاسترداد",
    };
  }
}

/** يُخفي رقم البطاقة ويُبقي آخر 4 أرقام فقط */
export function maskCardNumber(cardNumber: string): string {
  const clean = cardNumber.replace(/\s/g, "");
  if (clean.length < 4) return clean;
  return "**** **** **** " + clean.slice(-4);
}
