import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { createBooking, type PaymentMethod } from "@/lib/firebase-data";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";
import { doctors } from "@/data/mockData";
import * as Haptics from "expo-haptics";
import { PaymentSheet, type ProviderMeta } from "@/components/PaymentSheet";

const ERROR_COLOR = "#E53935";

type PayKind = "cash" | "electronic";

const ELECTRONIC_PROVIDERS: ProviderMeta[] = [
  { id: "zaincash", nameAr: "زين كاش", icon: "cellphone", color: "#7B2CBF", kind: "wallet" },
  { id: "fastpay", nameAr: "فاست باي", icon: "lightning-bolt", color: "#F59E0B", kind: "wallet" },
  { id: "asiahawala", nameAr: "آسيا حوالة", icon: "wallet", color: "#0EA5E9", kind: "wallet" },
  { id: "qicard", nameAr: "كي كارد (Qi)", icon: "credit-card", color: "#16A34A", kind: "card" },
  { id: "fib", nameAr: "FIB", icon: "bank", color: "#1F40C8", kind: "card" },
  { id: "nasspay", nameAr: "NassPay", icon: "qrcode", color: "#DC2626", kind: "wallet" },
];

export default function BookAppointmentScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { doctorId } = useLocalSearchParams<{ doctorId: string }>();

  const doctor = doctors.find((d) => d.id === doctorId);
  const [patientName, setPatientName] = useState(user?.fullName || "");
  const [age, setAge] = useState("");
  const [reason, setReason] = useState("");
  const [payKind, setPayKind] = useState<PayKind>("cash");
  const [provider, setProvider] = useState<ProviderMeta["id"] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paySheetOpen, setPaySheetOpen] = useState(false);

  const [errors, setErrors] = useState<{
    name?: boolean;
    age?: boolean;
    provider?: boolean;
  }>({});

  const selectedProvider = provider
    ? ELECTRONIC_PROVIDERS.find((p) => p.id === provider) ?? null
    : null;

  const validate = () => {
    const nameMissing = !patientName.trim();
    const ageNum = Number(age);
    const ageInvalid = !age || isNaN(ageNum) || ageNum < 1 || ageNum > 120;
    const providerMissing = payKind === "electronic" && !provider;

    if (nameMissing || ageInvalid || providerMissing) {
      setErrors({
        name: nameMissing,
        age: ageInvalid,
        provider: providerMissing,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return false;
    }
    setErrors({});
    return true;
  };

  const submitBookingToFirebase = async (
    paymentMethod: PaymentMethod,
    txId?: string,
  ) => {
    if (!doctor) {
      Alert.alert("خطأ", "الطبيب غير موجود");
      return;
    }
    setIsSubmitting(true);
    try {
      await createBooking(doctorId!, {
        patientName: patientName.trim(),
        accountOwnerName: user?.fullName || patientName.trim(),
        accountOwnerId: user?.id || user?.phoneNumber || "unknown",
        age: Number(age),
        phone: user?.phoneNumber || "",
        reason: reason.trim(),
        date: "",
        time: "",
        paymentMethod,
        paymentStatus: paymentMethod === "cash" ? "غير مدفوع" : "مدفوع",
        ...(txId
          ? { paymentTxId: txId, paymentPaidAt: Date.now() }
          : {}),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const payLabel =
        paymentMethod === "cash"
          ? "الدفع نقداً عند الزيارة"
          : `تم الدفع عبر ${ELECTRONIC_PROVIDERS.find((p) => p.id === paymentMethod)?.nameAr || ""}`;
      Alert.alert(
        "تم الحجز بنجاح ✅",
        `تم إرسال طلب حجزك مع ${doctor.nameAr}.\n${payLabel}.\nسيتم التواصل معك لتأكيد الموعد.`,
        [{ text: "حسناً", onPress: () => router.back() }],
      );
    } catch (e) {
      Alert.alert("خطأ", "فشل إرسال طلب الحجز. حاول مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (payKind === "cash") {
      await submitBookingToFirebase("cash");
      return;
    }
    // Electronic: open payment sheet to collect payment details
    setPaySheetOpen(true);
  };

  const handlePaymentSuccess = async (txId: string) => {
    setPaySheetOpen(false);
    if (!provider) return;
    await submitBookingToFirebase(provider, txId);
  };

  const baseInput = {
    backgroundColor: isDark ? theme.backgroundSecondary : "#F8FAFC",
    color: theme.text,
    fontFamily: "Tajawal_400Regular",
  };
  const inputBorder = (hasError?: boolean) => ({
    borderColor: hasError ? ERROR_COLOR : theme.border,
  });
  const labelColor = (hasError?: boolean) => ({
    color: hasError ? ERROR_COLOR : theme.textSecondary,
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {doctor ? (
          <Animated.View entering={FadeInUp.delay(50).duration(350)} style={[styles.doctorCard, { backgroundColor: isDark ? theme.card : "#FFF" }]}>
            <View style={[styles.doctorIcon, { backgroundColor: addAlpha(theme.primary, 0.1) }]}>
              <Feather name="user" size={28} color={theme.primary} />
            </View>
            <View style={styles.doctorCardInfo}>
              <ThemedText type="h4" style={{ fontWeight: "700", textAlign: "right" }}>{doctor.nameAr}</ThemedText>
              <ThemedText type="small" style={{ color: theme.primary, textAlign: "right" }}>{doctor.specialtyAr}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right" }}>{doctor.districtAr}، {doctor.provinceAr}</ThemedText>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInUp.delay(150).duration(350)} style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>بيانات المريض</ThemedText>

          <View style={styles.field}>
            <ThemedText type="small" style={[styles.label, labelColor(errors.name)]}>اسم المريض *</ThemedText>
            <TextInput
              value={patientName}
              onChangeText={(t) => {
                setPatientName(t);
                if (errors.name && t.trim()) setErrors((e) => ({ ...e, name: false }));
              }}
              placeholder="الاسم الكامل"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, baseInput, inputBorder(errors.name)]}
              textAlign="right"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="small" style={[styles.label, labelColor(errors.age)]}>العمر *</ThemedText>
            <TextInput
              value={age}
              onChangeText={(t) => {
                setAge(t);
                if (errors.age) {
                  const n = Number(t);
                  if (t && !isNaN(n) && n >= 1 && n <= 120) {
                    setErrors((e) => ({ ...e, age: false }));
                  }
                }
              }}
              placeholder="25"
              keyboardType="number-pad"
              maxLength={3}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, baseInput, inputBorder(errors.age), { textAlign: "right" }]}
              textAlign="right"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>سبب الزيارة (اختياري)</ThemedText>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="صف شكواك بإيجاز..."
              multiline
              numberOfLines={3}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, styles.textarea, baseInput, inputBorder(false)]}
              textAlignVertical="top"
              textAlign="right"
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(220).duration(350)} style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>طريقة الدفع</ThemedText>

          <View style={styles.payKindRow}>
            <PayKindCard
              active={payKind === "cash"}
              theme={theme}
              isDark={isDark}
              icon="cash"
              label="نقداً"
              hint="ادفع عند الزيارة"
              onPress={() => {
                setPayKind("cash");
                setProvider(null);
                if (errors.provider) setErrors((e) => ({ ...e, provider: false }));
              }}
            />
            <PayKindCard
              active={payKind === "electronic"}
              theme={theme}
              isDark={isDark}
              icon="credit-card-outline"
              label="إلكتروني"
              hint="محفظة أو بطاقة"
              onPress={() => setPayKind("electronic")}
            />
          </View>

          {payKind === "electronic" ? (
            <View style={{ gap: Spacing.sm, marginTop: 4 }}>
              <ThemedText type="small" style={[styles.label, labelColor(errors.provider)]}>
                اختر طريقة الدفع *
              </ThemedText>
              <View style={styles.providerGrid}>
                {ELECTRONIC_PROVIDERS.map((p) => {
                  const selected = provider === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        setProvider(p.id);
                        if (errors.provider) setErrors((e) => ({ ...e, provider: false }));
                        Haptics.selectionAsync();
                      }}
                      style={[
                        styles.providerCard,
                        {
                          backgroundColor: isDark ? theme.backgroundSecondary : "#F8FAFC",
                          borderColor: selected
                            ? p.color
                            : errors.provider
                              ? ERROR_COLOR
                              : theme.border,
                          borderWidth: selected ? 2 : 1.5,
                        },
                      ]}
                    >
                      <View style={[styles.providerIcon, { backgroundColor: addAlpha(p.color, 0.12) }]}>
                        <MaterialCommunityIcons name={p.icon} size={22} color={p.color} />
                      </View>
                      <ThemedText type="small" style={{ textAlign: "center", fontWeight: selected ? "700" : "500", color: theme.text }}>
                        {p.nameAr}
                      </ThemedText>
                      {selected ? (
                        <View style={[styles.providerCheck, { backgroundColor: p.color }]}>
                          <Feather name="check" size={11} color="#FFF" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).duration(350)} style={[styles.disclaimer, { backgroundColor: addAlpha(theme.primary, 0.06), borderColor: addAlpha(theme.primary, 0.2) }]}>
          <Feather name="info" size={14} color={theme.primary} style={{ marginLeft: 6 }} />
          <ThemedText type="caption" style={{ color: theme.textSecondary, flex: 1, textAlign: "right" }}>
            سيتم مراجعة طلبك من قبل العيادة والتواصل معك لتأكيد الموعد
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350).duration(350)}>
          <Button onPress={handleSubmit} disabled={isSubmitting} style={styles.submitBtn}>
            {isSubmitting
              ? "جاري الإرسال..."
              : payKind === "electronic"
                ? "متابعة إلى الدفع"
                : "إرسال طلب الحجز"}
          </Button>
        </Animated.View>
      </ScrollView>

      <PaymentSheet
        visible={paySheetOpen}
        provider={selectedProvider}
        onCancel={() => setPaySheetOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </KeyboardAvoidingView>
  );
}

interface PayKindCardProps {
  active: boolean;
  theme: any;
  isDark: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}
function PayKindCard({ active, theme, isDark, icon, label, hint, onPress }: PayKindCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.payKindCard,
        {
          backgroundColor: active
            ? addAlpha(theme.primary, 0.08)
            : isDark
              ? theme.backgroundSecondary
              : "#F8FAFC",
          borderColor: active ? theme.primary : theme.border,
          borderWidth: active ? 2 : 1.5,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={26}
        color={active ? theme.primary : theme.textSecondary}
      />
      <ThemedText type="small" style={{ fontWeight: "700", color: active ? theme.primary : theme.text, textAlign: "center" }}>
        {label}
      </ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>
        {hint}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.xl, gap: Spacing.xl },
  doctorCard: { flexDirection: "row-reverse" as const, alignItems: "center", padding: Spacing.lg, borderRadius: BorderRadius.xl, gap: Spacing.md },
  doctorIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  doctorCardInfo: { flex: 1 },
  section: { gap: Spacing.md },
  sectionTitle: { textAlign: "right", fontWeight: "700" },
  field: {},
  label: { textAlign: "right", marginBottom: 4, fontWeight: "500" },
  input: { height: Spacing.inputHeight, borderRadius: BorderRadius.sm, borderWidth: 1.5, paddingHorizontal: Spacing.lg, fontSize: 16 },
  textarea: { height: 90, paddingTop: Spacing.md },
  disclaimer: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.sm, borderWidth: 1 },
  submitBtn: {},
  payKindRow: { flexDirection: "row-reverse" as const, gap: Spacing.md },
  payKindCard: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  providerGrid: {
    flexDirection: "row-reverse" as const,
    flexWrap: "wrap" as const,
    gap: Spacing.md,
  },
  providerCard: {
    width: "31%" as const,
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: Spacing.sm,
    position: "relative" as const,
  },
  providerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  providerCheck: {
    position: "absolute" as const,
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
});
