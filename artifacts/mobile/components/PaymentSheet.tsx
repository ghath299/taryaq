import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";
import type { PaymentMethod } from "@/lib/firebase-data";

const ERROR_COLOR = "#E53935";

export type ProviderKind = "wallet" | "card";

export interface ProviderMeta {
  id: Exclude<PaymentMethod, "cash">;
  nameAr: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  kind: ProviderKind;
}

export interface PaymentDetails {
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  walletPhone?: string;
  walletPin?: string;
}

interface PaymentSheetProps {
  visible: boolean;
  provider: ProviderMeta | null;
  amount?: number;
  onCancel: () => void;
  onSuccess: (txId: string) => void;
  /**
   * Optional custom processor. If provided, PaymentSheet will call this
   * instead of using the built-in simulation. Must return success + txId
   * or throw / return failure with a message.
   */
  onProcess?: (details: PaymentDetails) => Promise<{
    success: boolean;
    transactionId?: string;
    message?: string;
  }>;
}

export function PaymentSheet({
  visible,
  provider,
  amount,
  onCancel,
  onSuccess,
  onProcess,
}: PaymentSheetProps) {
  const { theme, isDark } = useTheme();

  // Wallet fields
  const [walletPhone, setWalletPhone] = useState("");
  const [walletPin, setWalletPin] = useState("");

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [stage, setStage] = useState<"form" | "processing" | "success">("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setWalletPhone("");
      setWalletPin("");
      setCardNumber("");
      setCardExpiry("");
      setCardCvv("");
      setErrors({});
      setErrorMsg(null);
      setStage("form");
    }
  }, [visible]);

  if (!provider) return null;

  const formatCardNumber = (raw: string) =>
    raw
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(.{4})/g, "$1 ")
      .trim();

  const formatExpiry = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const validate = () => {
    const e: Record<string, boolean> = {};
    if (provider.kind === "wallet") {
      if (!/^07[3-9]\d{8}$/.test(walletPhone.trim())) e.walletPhone = true;
      if (!/^\d{4,6}$/.test(walletPin.trim())) e.walletPin = true;
    } else {
      const digits = cardNumber.replace(/\s/g, "");
      if (digits.length < 13 || digits.length > 19) e.cardNumber = true;
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) e.cardExpiry = true;
      if (!/^\d{3,4}$/.test(cardCvv)) e.cardCvv = true;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePay = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setStage("processing");
    setErrorMsg(null);
    Haptics.selectionAsync();

    let txId = `TX${Date.now()}`;
    let ok = true;
    let message: string | undefined;

    if (onProcess) {
      try {
        const result = await onProcess({
          cardNumber: cardNumber.replace(/\s/g, ""),
          cardExpiry,
          cardCvv,
          walletPhone,
          walletPin,
        });
        ok = !!result.success;
        message = result.message;
        if (result.transactionId) txId = result.transactionId;
      } catch (e: any) {
        ok = false;
        message = e?.message || "تعذّر إتمام الدفع";
      }
    } else {
      // Built-in simulation for providers without a custom processor
      await new Promise((r) => setTimeout(r, 1800));
    }

    if (!ok) {
      setStage("form");
      setErrorMsg(message || "فشلت عملية الدفع. حاول مرة أخرى.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setStage("success");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => onSuccess(txId), 900);
  };

  const inputBase = {
    backgroundColor: isDark ? theme.backgroundSecondary : "#F8FAFC",
    color: theme.text,
    fontFamily: "Tajawal_400Regular",
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => stage === "form" && onCancel()}
    >
      <View style={styles.backdrop}>
        <Animated.View
          entering={FadeInDown.duration(280)}
          exiting={FadeOut.duration(180)}
          style={[
            styles.sheet,
            { backgroundColor: theme.backgroundRoot, borderColor: theme.border },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={styles.header}>
                <View
                  style={[
                    styles.providerBadge,
                    { backgroundColor: addAlpha(provider.color, 0.12) },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={provider.icon}
                    size={26}
                    color={provider.color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    type="h4"
                    style={{ fontWeight: "700", textAlign: "right" }}
                  >
                    الدفع عبر {provider.nameAr}
                  </ThemedText>
                  {amount ? (
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary, textAlign: "right" }}
                    >
                      المبلغ: {amount.toLocaleString("ar-IQ")} د.ع
                    </ThemedText>
                  ) : (
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary, textAlign: "right" }}
                    >
                      اتمم عملية الدفع لتأكيد الحجز
                    </ThemedText>
                  )}
                </View>
                {stage === "form" ? (
                  <Pressable
                    onPress={onCancel}
                    hitSlop={10}
                    style={styles.closeBtn}
                  >
                    <Feather name="x" size={20} color={theme.textSecondary} />
                  </Pressable>
                ) : null}
              </View>

              {stage === "processing" ? (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  style={styles.statusBox}
                >
                  <ActivityIndicator size="large" color={provider.color} />
                  <ThemedText
                    type="body"
                    style={{ color: theme.text, marginTop: Spacing.md, fontWeight: "600" }}
                  >
                    جاري معالجة الدفع...
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, marginTop: 4 }}
                  >
                    يرجى الانتظار
                  </ThemedText>
                </Animated.View>
              ) : stage === "success" ? (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  style={styles.statusBox}
                >
                  <View
                    style={[
                      styles.successIcon,
                      { backgroundColor: addAlpha("#16A34A", 0.12) },
                    ]}
                  >
                    <Feather name="check" size={36} color="#16A34A" />
                  </View>
                  <ThemedText
                    type="h4"
                    style={{ color: "#16A34A", marginTop: Spacing.md, fontWeight: "700" }}
                  >
                    تم الدفع بنجاح
                  </ThemedText>
                </Animated.View>
              ) : provider.kind === "wallet" ? (
                <View style={{ gap: Spacing.md, marginTop: Spacing.lg }}>
                  <Field
                    label="رقم المحفظة"
                    error={errors.walletPhone}
                    theme={theme}
                  >
                    <TextInput
                      value={walletPhone}
                      onChangeText={(t) => {
                        setWalletPhone(t.replace(/[^0-9]/g, "").slice(0, 11));
                        if (errors.walletPhone)
                          setErrors((e) => ({ ...e, walletPhone: false }));
                      }}
                      placeholder="07XXXXXXXXX"
                      keyboardType="phone-pad"
                      maxLength={11}
                      placeholderTextColor={theme.textSecondary}
                      style={[
                        styles.input,
                        inputBase,
                        {
                          borderColor: errors.walletPhone
                            ? ERROR_COLOR
                            : theme.border,
                        },
                      ]}
                      textAlign="right"
                    />
                  </Field>
                  <Field
                    label="الرمز السري (PIN)"
                    error={errors.walletPin}
                    theme={theme}
                  >
                    <TextInput
                      value={walletPin}
                      onChangeText={(t) => {
                        setWalletPin(t.replace(/[^0-9]/g, "").slice(0, 6));
                        if (errors.walletPin)
                          setErrors((e) => ({ ...e, walletPin: false }));
                      }}
                      placeholder="••••"
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={6}
                      placeholderTextColor={theme.textSecondary}
                      style={[
                        styles.input,
                        inputBase,
                        {
                          borderColor: errors.walletPin
                            ? ERROR_COLOR
                            : theme.border,
                          letterSpacing: 8,
                          textAlign: "center",
                        },
                      ]}
                    />
                  </Field>
                </View>
              ) : (
                <View style={{ gap: Spacing.md, marginTop: Spacing.lg }}>
                  <Field
                    label="رقم البطاقة"
                    error={errors.cardNumber}
                    theme={theme}
                  >
                    <TextInput
                      value={cardNumber}
                      onChangeText={(t) => {
                        setCardNumber(formatCardNumber(t));
                        if (errors.cardNumber)
                          setErrors((e) => ({ ...e, cardNumber: false }));
                      }}
                      placeholder="0000 0000 0000 0000"
                      keyboardType="number-pad"
                      maxLength={19}
                      placeholderTextColor={theme.textSecondary}
                      style={[
                        styles.input,
                        inputBase,
                        {
                          borderColor: errors.cardNumber
                            ? ERROR_COLOR
                            : theme.border,
                          letterSpacing: 1,
                        },
                      ]}
                      textAlign="right"
                    />
                  </Field>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="تاريخ الانتهاء"
                        error={errors.cardExpiry}
                        theme={theme}
                      >
                        <TextInput
                          value={cardExpiry}
                          onChangeText={(t) => {
                            setCardExpiry(formatExpiry(t));
                            if (errors.cardExpiry)
                              setErrors((e) => ({ ...e, cardExpiry: false }));
                          }}
                          placeholder="MM/YY"
                          keyboardType="number-pad"
                          maxLength={5}
                          placeholderTextColor={theme.textSecondary}
                          style={[
                            styles.input,
                            inputBase,
                            {
                              borderColor: errors.cardExpiry
                                ? ERROR_COLOR
                                : theme.border,
                              textAlign: "center",
                            },
                          ]}
                        />
                      </Field>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="CVV"
                        error={errors.cardCvv}
                        theme={theme}
                      >
                        <TextInput
                          value={cardCvv}
                          onChangeText={(t) => {
                            setCardCvv(t.replace(/[^0-9]/g, "").slice(0, 4));
                            if (errors.cardCvv)
                              setErrors((e) => ({ ...e, cardCvv: false }));
                          }}
                          placeholder="•••"
                          keyboardType="number-pad"
                          secureTextEntry
                          maxLength={4}
                          placeholderTextColor={theme.textSecondary}
                          style={[
                            styles.input,
                            inputBase,
                            {
                              borderColor: errors.cardCvv
                                ? ERROR_COLOR
                                : theme.border,
                              textAlign: "center",
                              letterSpacing: 6,
                            },
                          ]}
                        />
                      </Field>
                    </View>
                  </View>
                </View>
              )}

              {stage === "form" ? (
                <View style={{ marginTop: Spacing.xl, gap: Spacing.md }}>
                  {errorMsg ? (
                    <View
                      style={[
                        styles.errorBanner,
                        {
                          backgroundColor: addAlpha(ERROR_COLOR, 0.1),
                          borderColor: addAlpha(ERROR_COLOR, 0.3),
                        },
                      ]}
                    >
                      <Feather
                        name="alert-circle"
                        size={14}
                        color={ERROR_COLOR}
                        style={{ marginLeft: 6 }}
                      />
                      <ThemedText
                        type="caption"
                        style={{ color: ERROR_COLOR, flex: 1, textAlign: "right" }}
                      >
                        {errorMsg}
                      </ThemedText>
                    </View>
                  ) : null}
                  <Button onPress={handlePay} style={{}}>
                    {amount
                      ? `ادفع ${amount.toLocaleString("ar-IQ")} د.ع`
                      : "ادفع الآن"}
                  </Button>
                  <Pressable onPress={onCancel} style={styles.cancelBtn}>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary, textAlign: "center" }}
                    >
                      إلغاء
                    </ThemedText>
                  </Pressable>
                  <View
                    style={[
                      styles.secureNote,
                      {
                        backgroundColor: addAlpha(provider.color, 0.06),
                        borderColor: addAlpha(provider.color, 0.2),
                      },
                    ]}
                  >
                    <Feather
                      name="lock"
                      size={12}
                      color={provider.color}
                      style={{ marginLeft: 6 }}
                    />
                    <ThemedText
                      type="caption"
                      style={{
                        color: theme.textSecondary,
                        flex: 1,
                        textAlign: "right",
                      }}
                    >
                      بياناتك مشفّرة ولا تُحفظ على خوادمنا
                    </ThemedText>
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface FieldProps {
  label: string;
  error?: boolean;
  theme: any;
  children: React.ReactNode;
}
function Field({ label, error, theme, children }: FieldProps) {
  return (
    <View>
      <ThemedText
        type="small"
        style={{
          textAlign: "right",
          marginBottom: 4,
          fontWeight: "500",
          color: error ? ERROR_COLOR : theme.textSecondary,
        }}
      >
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl + 12,
    borderTopWidth: 1,
    maxHeight: "92%" as const,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.md,
    paddingTop: 4,
  },
  providerBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: { padding: 4 },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  row: { flexDirection: "row-reverse", gap: Spacing.md },
  cancelBtn: { padding: Spacing.md },
  statusBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  secureNote: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
});
