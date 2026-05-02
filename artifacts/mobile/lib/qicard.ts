/**
 * Backward-compat shim. The implementation moved to lib/payment/qicard.ts.
 * Prefer importing from `@/lib/payment/qicard` directly.
 */
export {
  QI_CARD_CONFIG,
  TEST_CARDS,
  processPayment,
  processPayment as processQiCardPayment,
  verifyPayment,
  refundPayment,
  maskCardNumber,
  resetPaymentAttempts,
  type QiCardConfig,
  type ProcessPaymentParams,
  type ProcessPaymentParams as QiCardPaymentParams,
  type PaymentResult,
  type PaymentResult as QiCardPaymentResult,
} from "@/lib/payment/qicard";
