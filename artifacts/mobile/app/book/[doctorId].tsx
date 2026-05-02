import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { createBooking } from "@/lib/firebase-data";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";
import { doctors } from "@/data/mockData";
import * as Haptics from "expo-haptics";

const ERROR_COLOR = "#E53935";

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errors, setErrors] = useState<{ name?: boolean; age?: boolean }>({});

  const handleSubmit = async () => {
    const nameMissing = !patientName.trim();
    const ageNum = Number(age);
    const ageInvalid = !age || isNaN(ageNum) || ageNum < 1 || ageNum > 120;

    if (nameMissing || ageInvalid) {
      setErrors({ name: nameMissing, age: ageInvalid });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setErrors({});
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
        age: ageNum,
        phone: user?.phoneNumber || "",
        reason: reason.trim(),
        date: "",
        time: "",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "تم الحجز بنجاح ✅",
        `تم إرسال طلب حجزك مع ${doctor.nameAr}. سيتم التواصل معك لتأكيد الموعد.`,
        [{ text: "حسناً", onPress: () => router.back() }],
      );
    } catch (e) {
      Alert.alert("خطأ", "فشل إرسال طلب الحجز. حاول مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
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
            <ThemedText type="small" style={[styles.label, labelColor(errors.name)]}>
              اسم المريض *
            </ThemedText>
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
            <ThemedText type="small" style={[styles.label, labelColor(errors.age)]}>
              العمر *
            </ThemedText>
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
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
              سبب الزيارة (اختياري)
            </ThemedText>
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

        <Animated.View entering={FadeInUp.delay(250).duration(350)} style={[styles.disclaimer, { backgroundColor: addAlpha(theme.primary, 0.06), borderColor: addAlpha(theme.primary, 0.2) }]}>
          <Feather name="info" size={14} color={theme.primary} style={{ marginLeft: 6 }} />
          <ThemedText type="caption" style={{ color: theme.textSecondary, flex: 1, textAlign: "right" }}>
            سيتم مراجعة طلبك من قبل العيادة والتواصل معك لتأكيد الموعد
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350).duration(350)}>
          <Button onPress={handleSubmit} disabled={isSubmitting} style={styles.submitBtn}>
            {isSubmitting ? "جاري الإرسال..." : "إرسال طلب الحجز"}
          </Button>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
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
});
