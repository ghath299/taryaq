/**
 * Qi Card payment integration.
 *
 * Currently runs in TEST MODE — simulates a successful payment without
 * contacting any real API. When you receive merchant credentials from
 * Qi Card, replace the values in QI_CARD_CONFIG and set isTestMode to false.
 * The real API call below will then take over automatically.
 */

export interface QiCardConfig {
  merchantId: string;
  apiKey: string;
  secretKey: string;
  apiUrl: string;
  isTestMode: boolean;
}

export const QI_CARD_CONFIG: QiCardConfig = {
  merchantId: "MERCHANT_ID_HERE",
  apiKey: "API_KEY_HERE",
  secretKey: "SECRET_KEY_HERE",
  apiUrl: "https://api.qicard.iq/v1",
  isTestMode: true,
};

export interface QiCardPaymentParams {
  amount: number;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  patientId: string;
  bookingId: string;
  doctorId: string;
}

export interface QiCardPaymentResult {
  success: boolean;
  transactionId?: string;
  message: string;
  rawResponse?: unknown;
}

export const processQiCardPayment = async (
  params: QiCardPaymentParams,
): Promise<QiCardPaymentResult> => {
  if (QI_CARD_CONFIG.isTestMode) {
    // Simulated processing delay so the UI feels real
    await new Promise((r) => setTimeout(r, 1500));
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
        card_number: params.cardNumber.replace(/\s/g, ""),
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
      message: e?.message || "تعذّر الاتصال بخدمة الدفع",
    };
  }
};
