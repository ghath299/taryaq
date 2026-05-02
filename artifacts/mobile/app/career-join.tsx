import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";
import * as Haptics from "expo-haptics";

type JoinType = "doctor" | "pharmacist" | null;

export default function CareerJoinScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [joinType, setJoinType] = useState<JoinType>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [province, setProvince] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!joinType) { Alert.alert("خطأ", "اختر نوع التسجيل أولاً"); return; }
    if (!name.trim() || !phone.trim() || !specialty.trim()) {
      Alert.alert("خطأ", "يرجى ملء الحقول المطلوبة"); return;
    }
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsSubmitting(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      "تم إرسال طلبك ✅",
      "شكراً لاهتمامك بالانضمام إلى ترياق. سيتواصل معك فريقنا خلال 48 ساعة.",
      [{ text: "حسناً" }]
    );
    setName(""); setPhone(""); setSpecialty(""); setProvince(""); setNotes(""); setJoinType(null);
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: isDark ? theme.backgroundSecondary : "#F8FAFC",
      borderColor: theme.border,
      color: theme.text,
      fontFamily: "Tajawal_400Regular",
    },
  ];

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
        <Animated.View entering={FadeIn.duration(400)} style={styles.heroSection}>
          <LinearGradient colors={[theme.primary, theme.primaryDark]} style={styles.heroIcon}>
            <Feather name="briefcase" size={52} color="#FFF" />
          </LinearGradient>
          <ThemedText type="h2" style={[styles.heroTitle, { color: theme.text }]}>انضم إلى ترياق</ThemedText>
          <ThemedText type="body" style={[styles.heroDesc, { color: theme.textSecondary }]}>
            سجّل بياناتك وسيتواصل معك فريقنا لمناقشة كيفية الانضمام إلى منصتنا الصحية
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>اختر نوع التسجيل *</ThemedText>
          <View style={styles.typeRow}>
            {[
              { type: "doctor" as JoinType, icon: "user" as const, label: "طبيب", desc: "سجّل عيادتك ووسّع قاعدة مرضاك" },
              { type: "pharmacist" as JoinType, icon: "package" as const, label: "صيدلاني", desc: "أضف صيدليتك واستقبل الطلبات إلكترونياً" },
            ].map((opt) => (
              <Pressable
                key={opt.type}
                onPress={() => { setJoinType(opt.type); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: joinType === opt.type ? addAlpha(theme.primary, 0.1) : (isDark ? theme.card : "#FFF"),
                    borderColor: joinType === opt.type ? theme.primary : theme.border,
                    borderWidth: joinType === opt.type ? 2 : 1,
                  },
                ]}
              >
                <LinearGradient
                  colors={joinType === opt.type ? [theme.primary, theme.primaryDark] : [addAlpha(theme.primary, 0.1), addAlpha(theme.primary, 0.06)]}
                  style={styles.typeIcon}
                >
                  <Feather name={opt.icon} size={24} color={joinType === opt.type ? "#FFF" : theme.primary} />
                </LinearGradient>
                <ThemedText type="h4" style={[styles.typeLabel, { color: joinType === opt.type ? theme.primary : theme.text }]}>{opt.label}</ThemedText>
                <ThemedText type="caption" style={[styles.typeDesc, { color: theme.textSecondary }]}>{opt.desc}</ThemedText>
                {joinType === opt.type && (
                  <View style={[styles.checkMark, { backgroundColor: theme.primary }]}>
                    <Feather name="check" size={12} color="#FFF" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>المعلومات الشخصية</ThemedText>
          <View style={styles.field}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>الاسم الثلاثي *</ThemedText>
            <TextInput value={name} onChangeText={setName} placeholder="أدخل اسمك الثلاثي" placeholderTextColor={theme.textSecondary} style={inputStyle} textAlign="right" />
          </View>
          <View style={styles.field}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>رقم الهاتف *</ThemedText>
            <TextInput value={phone} onChangeText={setPhone} placeholder="07XXXXXXXXX" keyboardType="phone-pad" placeholderTextColor={theme.textSecondary} style={inputStyle} textAlign="right" />
          </View>
          <View style={styles.fieldRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>التخصص *</ThemedText>
              <TextInput value={specialty} onChangeText={setSpecialty} placeholder="مثل: طب عام" placeholderTextColor={theme.textSecondary} style={inputStyle} textAlign="right" />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>المحافظة</ThemedText>
              <TextInput value={province} onChangeText={setProvince} placeholder="بغداد" placeholderTextColor={theme.textSecondary} style={inputStyle} textAlign="right" />
            </View>
          </View>
          <View style={styles.field}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>ملاحظات إضافية</ThemedText>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="أي معلومات إضافية تودّ ذكرها..."
              multiline
              numberOfLines={3}
              placeholderTextColor={theme.textSecondary}
              style={[inputStyle, styles.textarea]}
              textAlignVertical="top"
              textAlign="right"
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).duration(400)}>
          <Button onPress={handleSubmit} disabled={isSubmitting} style={styles.submitBtn}>
            {isSubmitting ? "جاري الإرسال..." : "إرسال الطلب"}
          </Button>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.xl, gap: Spacing.xl },
  heroSection: { alignItems: "center", paddingVertical: Spacing.lg },
  heroIcon: { width: 100, height: 100, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: Spacing.xl },
  heroTitle: { fontWeight: "800", textAlign: "center", marginBottom: Spacing.sm },
  heroDesc: { textAlign: "center", lineHeight: 26 },
  section: { gap: Spacing.md },
  sectionTitle: { textAlign: "right", fontWeight: "700" },
  typeRow: { flexDirection: "row", gap: Spacing.md },
  typeCard: { flex: 1, alignItems: "center", padding: Spacing.lg, borderRadius: BorderRadius.xl, gap: Spacing.sm },
  typeIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  typeLabel: { fontWeight: "700" },
  typeDesc: { textAlign: "center", fontSize: 11, lineHeight: 16 },
  checkMark: { position: "absolute", top: 8, left: 8, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  field: {},
  fieldRow: { flexDirection: "row-reverse" as const, gap: Spacing.md },
  label: { textAlign: "right", marginBottom: 4, fontWeight: "500" },
  input: { height: Spacing.inputHeight, borderRadius: BorderRadius.sm, borderWidth: 1.5, paddingHorizontal: Spacing.lg, fontSize: 16 },
  textarea: { height: 90, paddingTop: Spacing.md },
  submitBtn: {},
});
