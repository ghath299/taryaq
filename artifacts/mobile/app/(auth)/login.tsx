import React, { useState, useRef } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ name: "", phone: "" });
  const phoneRef = useRef<TextInput>(null);

  const validateName = (value: string) => {
    const words = value.trim().split(/\s+/).filter((w) => w.length > 1);
    if (words.length < 2) return "الرجاء إدخال الاسم الثلاثي على الأقل";
    return "";
  };

  const validatePhone = (value: string) => {
    if (!/^07[3-9]\d{8}$/.test(value)) return "رقم الهاتف العراقي غير صحيح";
    return "";
  };

  const handleSubmit = async () => {
    const nameErr = validateName(fullName);
    const phoneErr = validatePhone(phoneNumber);
    setErrors({ name: nameErr, phone: phoneErr });
    if (nameErr || phoneErr) return;

    setIsLoading(true);
    try {
      await login(fullName.trim(), phoneNumber.trim());
      router.replace("/(auth)/location");
    } catch (e) {
      Alert.alert("خطأ", "حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = (err: string) => [
    styles.input,
    {
      backgroundColor: isDark ? theme.card : "#FFFFFF",
      borderColor: err ? theme.error : theme.border,
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
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(500)} style={styles.headerSection}>
          <LinearGradient colors={[theme.primary, theme.primaryDark]} style={styles.logoContainer}>
            <Feather name="heart" size={36} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="hero" style={[styles.appName, { color: theme.primary }]}>
            ترياق
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            منصتك الصحية الأولى في العراق
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(500)} style={[styles.formCard, { backgroundColor: isDark ? theme.card : "#FFFFFF" }]}>
          <ThemedText type="h3" style={styles.cardTitle}>
            مرحباً بك
          </ThemedText>
          <ThemedText type="small" style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
            أدخل بياناتك للمتابعة
          </ThemedText>

          <View style={styles.fieldGroup}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
              الاسم الثلاثي
            </ThemedText>
            <TextInput
              value={fullName}
              onChangeText={(t) => { setFullName(t); setErrors((e) => ({ ...e, name: "" })); }}
              placeholder="أدخل اسمك الثلاثي"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              style={inputStyle(errors.name)}
              textAlign="right"
            />
            {errors.name ? (
              <ThemedText type="caption" style={[styles.errorText, { color: theme.error }]}>
                {errors.name}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
              رقم الهاتف
            </ThemedText>
            <View style={styles.phoneRow}>
              <View style={[styles.countryCode, { backgroundColor: isDark ? theme.backgroundSecondary : theme.backgroundRoot, borderColor: errors.phone ? theme.error : theme.border }]}>
                <ThemedText type="body" style={{ color: theme.text, fontWeight: "700" }}>🇮🇶</ThemedText>
                <ThemedText type="small" style={{ color: theme.text }}>+964</ThemedText>
              </View>
              <TextInput
                ref={phoneRef}
                value={phoneNumber}
                onChangeText={(t) => { setPhoneNumber(t.replace(/[^0-9]/g, "")); setErrors((e) => ({ ...e, phone: "" })); }}
                placeholder="07XXXXXXXXX"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                maxLength={11}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                style={[inputStyle(errors.phone), styles.phoneInput]}
                textAlign="right"
              />
            </View>
            {errors.phone ? (
              <ThemedText type="caption" style={[styles.errorText, { color: theme.error }]}>
                {errors.phone}
              </ThemedText>
            ) : null}
          </View>

          <Button onPress={handleSubmit} disabled={isLoading} style={styles.submitBtn}>
            {isLoading ? "جاري المتابعة..." : "متابعة"}
          </Button>

          <View style={[styles.disclaimer, { backgroundColor: addAlpha(theme.primary, 0.06), borderColor: addAlpha(theme.primary, 0.2) }]}>
            <Feather name="shield" size={14} color={theme.primary} style={{ marginLeft: 6 }} />
            <ThemedText type="caption" style={{ color: theme.textSecondary, flex: 1, textAlign: "right" }}>
              بياناتك محمية ومشفرة ولن تُشارك مع أي طرف ثالث
            </ThemedText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.footer}>
          <ThemedText type="caption" style={[styles.footerText, { color: theme.textSecondary }]}>
            بالمتابعة، أنت توافق على{" "}
            <ThemedText type="caption" style={{ color: theme.primary }}>الشروط والأحكام</ThemedText>
            {" "}و{" "}
            <ThemedText type="caption" style={{ color: theme.primary }}>سياسة الخصوصية</ThemedText>
          </ThemedText>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: Spacing.xl },
  headerSection: { alignItems: "center", marginBottom: Spacing["3xl"] },
  logoContainer: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg },
  appName: { fontWeight: "800", marginBottom: Spacing.xs },
  subtitle: { textAlign: "center" },
  formCard: { borderRadius: BorderRadius.xl, padding: Spacing["2xl"], marginBottom: Spacing.xl },
  cardTitle: { textAlign: "right", fontWeight: "700", marginBottom: Spacing.xs },
  cardSubtitle: { textAlign: "right", marginBottom: Spacing["2xl"] },
  fieldGroup: { marginBottom: Spacing.lg },
  label: { textAlign: "right", marginBottom: Spacing.xs, fontWeight: "500" },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  errorText: { textAlign: "right", marginTop: 4 },
  phoneRow: { flexDirection: "row", gap: Spacing.sm },
  countryCode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
  },
  phoneInput: { flex: 1 },
  submitBtn: { marginTop: Spacing.md, marginBottom: Spacing.md },
  disclaimer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  footer: { alignItems: "center" },
  footerText: { textAlign: "center" },
});
