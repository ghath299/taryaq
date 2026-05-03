import React, { useState, useRef } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/colors";

const lightIllustration = require("@/assets/images/doctor-consultation-light.jpeg");
const darkIllustration = require("@/assets/images/doctor-consultation-dark.jpeg");

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [website, setWebsite] = useState("");
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
      await login(fullName.trim(), phoneNumber.trim(), website);
      router.replace("/(auth)/location");
    } catch (e) {
      Alert.alert("خطأ", "حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.");
    } finally {
      setIsLoading(false);
    }
  };

  const screenBg = isDark ? "#0A0F1A" : "#FFFFFF";
  const inputBg = isDark ? "#161B22" : "#F7F8FB";
  const inputBorder = isDark ? "#21262D" : "#EFEFEF";
  const buttonColor = "#1F40C8";
  const titleColor = isDark ? "#5EDFFF" : "#1F40C8";

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: screenBg }}>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: screenBg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: Platform.OS === "web" ? 64 : 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(500)} style={styles.headerSection}>
          <View style={styles.titleRow}>
            <ThemedText
              style={[styles.appName, { color: titleColor, fontFamily: "Cairo-Regular" }]}
            >
              ترياق
            </ThemedText>
            <ThemedText style={styles.leafEmoji}>🌿</ThemedText>
          </View>
          <ThemedText
            style={[
              styles.tagline,
              { color: isDark ? "#8B95A5" : "#9BA5B5", fontFamily: "Cairo-Regular" },
            ]}
          >
            رفيقك نحو صحة أفضل
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(150).duration(600)} style={styles.illustrationWrapper}>
          <Image
            source={isDark ? darkIllustration : lightIllustration}
            style={styles.illustration}
            contentFit="contain"
            priority="high"
            cachePolicy="memory-disk"
          />
        </Animated.View>

        <View style={styles.welcomeBlock}>
          <View style={styles.welcomeRow}>
            <ThemedText style={[styles.welcomeSmall, { color: theme.text, fontFamily: "Cairo-Regular" }]}>
              أهلاً وسهلاً بك في ترياق
            </ThemedText>
            <ThemedText style={styles.welcomeLeaf}>🌿</ThemedText>
          </View>
          <ThemedText style={[styles.welcomeBig, { color: theme.text, fontFamily: "Cairo-Regular" }]}>
            سجّل دخولك للمتابعة
          </ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <TextInput
              value={fullName}
              onChangeText={(t) => {
                setFullName(t);
                setErrors((e) => ({ ...e, name: "" }));
              }}
              placeholder="الاسم الثلاثي"
              placeholderTextColor={isDark ? "#6C757D" : "#A0A8B5"}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              style={[
                styles.input,
                {
                  backgroundColor: inputBg,
                  borderColor: errors.name ? theme.error : inputBorder,
                  color: theme.text,
                  fontFamily: "Cairo-Regular",
                },
              ]}
              textAlign="right"
            />
            {errors.name ? (
              <ThemedText style={[styles.errorText, { color: theme.error, fontFamily: "Cairo-Regular" }]}>
                {errors.name}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <View
              style={[
                styles.input,
                styles.phoneRow,
                {
                  backgroundColor: inputBg,
                  borderColor: errors.phone ? theme.error : inputBorder,
                },
              ]}
            >
              <TextInput
                ref={phoneRef}
                value={phoneNumber}
                onChangeText={(t) => {
                  setPhoneNumber(t.replace(/[^0-9]/g, ""));
                  setErrors((e) => ({ ...e, phone: "" }));
                }}
                placeholder="رقم الهاتف"
                placeholderTextColor={isDark ? "#6C757D" : "#A0A8B5"}
                keyboardType="phone-pad"
                maxLength={11}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                style={[
                  styles.phoneInput,
                  { color: theme.text, fontFamily: "Cairo-Regular" },
                ]}
                textAlign="right"
              />
              <View style={styles.phoneDivider} />
              <ThemedText
                style={[styles.phonePrefix, { color: theme.text, fontFamily: "Cairo-Regular" }]}
              >
                +964
              </ThemedText>
            </View>
            {errors.phone ? (
              <ThemedText style={[styles.errorText, { color: theme.error, fontFamily: "Cairo-Regular" }]}>
                {errors.phone}
              </ThemedText>
            ) : null}
          </View>

          <TextInput
            value={website}
            onChangeText={setWebsite}
            autoComplete="off"
            autoCorrect={false}
            importantForAutofill="no"
            accessible={false}
            accessibilityElementsHidden
            style={styles.honeypot}
            pointerEvents="none"
          />

          <Pressable
            onPress={handleSubmit}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: buttonColor,
                opacity: isLoading ? 0.7 : pressed ? 0.9 : 1,
              },
            ]}
          >
            <ThemedText style={[styles.submitText, { fontFamily: "Cairo-Regular" }]}>
              {isLoading ? "جاري المتابعة..." : "متابعة"}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <ThemedText
            style={[styles.footerText, { color: isDark ? "#6C757D" : "#9BA5B5", fontFamily: "Cairo-Regular" }]}
          >
            بالمتابعة، أنت توافق على{" "}
            <ThemedText style={{ color: titleColor, fontFamily: "Cairo-Regular" }}>الشروط والأحكام</ThemedText>
            {" "}و{" "}
            <ThemedText style={{ color: titleColor, fontFamily: "Cairo-Regular" }}>سياسة الخصوصية</ThemedText>
          </ThemedText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  headerSection: {
    alignItems: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  appName: {
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: 0.5,
  },
  leafEmoji: {
    fontSize: 26,
  },
  tagline: {
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  illustrationWrapper: {
    width: "100%",
    height: 260,
    alignSelf: "center",
    marginVertical: Spacing.md,
  },
  illustration: {
    width: "100%",
    height: 260,
  },
  welcomeBlock: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  welcomeSmall: {
    fontSize: 13,
  },
  welcomeLeaf: {
    fontSize: 14,
  },
  welcomeBig: {
    fontSize: 22,
    lineHeight: 32,
    textAlign: "center",
  },
  form: {
    width: "100%",
  },
  fieldGroup: {
    marginBottom: Spacing.md,
  },
  input: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 0,
  },
  phoneInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
  },
  phoneDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E5E5EA",
  },
  phonePrefix: {
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
  },
  errorText: {
    textAlign: "right",
    marginTop: 4,
    fontSize: 12,
  },
  submitButton: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 17,
  },
  footer: {
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  footerText: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
  },
  honeypot: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    left: -9999,
    top: -9999,
  },
});
