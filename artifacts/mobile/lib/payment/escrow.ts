/**
 * نظام الـ Escrow (الوسيط) للدفعات.
 *
 * الفكرة:
 *   1. عند دفع المريض إلكترونياً → الحالة "held" (محتجزة لدى الوسيط).
 *   2. لو الطبيب وافق على الموعد → تبقى محتجزة حتى اكتمال الزيارة
 *      ثم تتحول إلى "paid" (تحرير للطبيب).
 *   3. لو الطبيب رفض الموعد → استرداد تلقائي للمريض ("refunded").
 *
 * ملاحظة مهمة:
 *   التحرير الفعلي للأموال إلى حساب الطبيب وكذلك الاسترداد الفعلي
 *   لا يمكن إنجازهما من جهاز العميل بأمان — يجب أن يحدث على خادم
 *   موثوق (Backend) يمتلك secretKey. هذا الملف يحدّث الحالة في
 *   Firebase ويستدعي qicard.refundPayment في وضع التجربة فقط.
 *   عند الإنتاج يجب نقل هذه العمليات إلى Cloud Functions أو
 *   خادم خاص.
 */

import {
  ref,
  update,
  get,
  serverTimestamp,
} from "firebase/database";
import { database } from "@/lib/firebase";
import { refundPayment } from "@/lib/payment/qicard";

export interface EscrowHoldParams {
  clinicId: string;
  bookingId: string;
  patientId: string;
  doctorId: string;
  amount: number;
  transactionId: string;
}

/** يحجز الدفعة بعد نجاح processPayment — يضع الحالة "held" */
export async function holdPayment(params: EscrowHoldParams): Promise<void> {
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`clinics/${params.clinicId}/bookings/${params.bookingId}/payment`]: {
      method: "qi_card",
      status: "held",
      amount: params.amount,
      transactionId: params.transactionId,
      paidAt: now,
    },
    [`transactions/${params.transactionId}`]: {
      clinicId: params.clinicId,
      bookingId: params.bookingId,
      patientId: params.patientId,
      doctorId: params.doctorId,
      amount: params.amount,
      currency: "IQD",
      status: "held",
      method: "qi_card",
      createdAt: now,
      updatedAt: serverTimestamp(),
    },
  };
  await update(ref(database), updates);
}

/** يُحرّر الدفعة للطبيب بعد اكتمال الزيارة → "paid" */
export async function releasePayment(params: {
  clinicId: string;
  bookingId: string;
  transactionId: string;
}): Promise<void> {
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`clinics/${params.clinicId}/bookings/${params.bookingId}/payment/status`]:
      "paid",
    [`clinics/${params.clinicId}/bookings/${params.bookingId}/payment/releasedAt`]:
      now,
    [`transactions/${params.transactionId}/status`]: "paid",
    [`transactions/${params.transactionId}/updatedAt`]: serverTimestamp(),
  };
  await update(ref(database), updates);
}

/** يسترد الدفعة للمريض في حالة رفض الطبيب → "refunded" */
export async function refundEscrow(params: {
  clinicId: string;
  bookingId: string;
  transactionId: string;
  reason?: string;
}): Promise<{ success: boolean; message: string }> {
  // 1. نطلب الاسترداد من بوابة الدفع (في الإنتاج هذا يجب أن يحدث على الخادم)
  const txSnap = await get(
    ref(database, `transactions/${params.transactionId}`),
  );
  const tx = txSnap.val();
  const refund = await refundPayment({
    transactionId: params.transactionId,
    amount: tx?.amount,
    reason: params.reason || "تم رفض الموعد من قبل الطبيب",
  });
  if (!refund.success) {
    // نسجّل المحاولة الفاشلة ونترك الحالة "held" لمعالجة يدوية
    await update(
      ref(database, `transactions/${params.transactionId}`),
      {
        lastRefundAttempt: serverTimestamp(),
        lastRefundError: refund.message,
      },
    );
    return { success: false, message: refund.message };
  }

  // 2. تحديث الحالة في Firebase
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`clinics/${params.clinicId}/bookings/${params.bookingId}/payment/status`]:
      "refunded",
    [`clinics/${params.clinicId}/bookings/${params.bookingId}/payment/refundedAt`]:
      now,
    [`transactions/${params.transactionId}/status`]: "refunded",
    [`transactions/${params.transactionId}/refundId`]: refund.transactionId,
    [`transactions/${params.transactionId}/updatedAt`]: serverTimestamp(),
  };
  await update(ref(database), updates);
  return { success: true, message: refund.message };
}
