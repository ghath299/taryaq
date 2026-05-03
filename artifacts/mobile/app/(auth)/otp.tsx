import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as ScreenCapture from "expo-screen-capture";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

const OTP_LENGTH = 6;

export default function OTPScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user, pendingPhone, verifyOTP, resendOTP, otpSentAt } = useAuth();
  const router = useRouter();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(60);
  const inputs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));
  const shakeX = useSharedValue(0);

  const displayPhone = (user?.phoneNumber || pendingPhone || "").replace(/(\d{4})(\d{3})(\d{4})/, "$1 $2 $3");

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // منع التقاط الشاشة على شاشة OTP فقط — يُفعَّل عند الدخول، يُلغى عند المغادرة
  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    ScreenCapture.preventScreenCaptureAsync().catch((err) => {
      console.warn("[OTP] preventScreenCapture failed:", err);
    });
    return () => {
      active = false;
      ScreenCapture.allowScreenCaptureAsync().catch((err) => {
        if (active) console.warn("[OTP] allowScreenCapture failed:", err);
      });
    };
  }, []);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }),
      withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }),
      withTiming(-4, { duration: 50 }), withTiming(0, { duration: 50 })
    );
  };

  const handleOTPChange = (text: string, index: number) => {
    const clean = text.replace(/[^0-9]/g, "");
    if (clean.length > 1) {
      const digits = clean.split("").slice(0, OTP_LENGTH);
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < OTP_LENGTH) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      inputs.current[nextIndex]?.focus();
      return;
    }
    const newOtp = [...otp];
    newOtp[index] = clean;
    setOtp(newOtp);
    setErrorMsg("");
    if (clean && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < OTP_LENGTH) {
      setErrorMsg("أدخل رمز التحقق كاملاً");
      triggerShake();
      return;
    }
    setIsLoading(true);
    setErrorMsg("");
    const inputDurationMs = otpSentAt > 0 ? Date.now() - otpSentAt : 9999;
    const result = await verifyOTP(code, inputDurationMs);
    setIsLoading(false);
    if (result.success) {
      router.replace("/(tabs)");
    } else {
      setErrorMsg(result.message || "رمز التحقق غير صحيح");
      triggerShake();
      setOtp(Array(OTP_LENGTH).fill(""));
      inputs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setIsResending(true);
    setErrorMsg("");
    const result = await resendOTP("telegram");
    setIsResending(false);
    if (result.success) {
      setCountdown(60);
      setOtp(Array(OTP_LENGTH).fill(""));
      inputs.current[0]?.focus();
      Alert.alert("تم إعادة الإرسال", "تم إرسال رمز تحقق جديد عبر تيليغرام");
    } else {
      setErrorMsg(result.message || "فشل إعادة الإرسال");
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 64 : 20, paddingBottom: insets.bottom + 20 }]}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <LinearGradient colors={[theme.primary, theme.primaryDark]} style={styles.iconBubble}>
            <Feather name="message-circle" size={36} color="#FFF" />
          </LinearGradient>
          <ThemedText type="h1" style={[styles.title, { color: theme.text }]}>التحقق برمز OTP</ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            أُرسل رمز مكوّن من 6 أرقام إلى
          </ThemedText>
          <ThemedText type="body" style={[styles.phone, { color: theme.primary }]}>
            {displayPhone}
          </ThemedText>
          <ThemedText type="small" style={[styles.channelNote, { color: theme.textSecondary }]}>
            عبر تطبيق تيليغرام
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <Animated.View style={[styles.otpRow, shakeStyle]}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <TextInput
                key={i}
                ref={(r) => { inputs.current[i] = r; }}
                value={otp[i]}
                onChangeText={(t) => handleOTPChange(t, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                selectTextOnFocus
                style={[
                  styles.otpInput,
                  {
                    backgroundColor: isDark ? theme.card : "#FFFFFF",
                    borderColor: errorMsg ? theme.error : otp[i] ? theme.primary : theme.border,
                    color: theme.text,
                    fontFamily: "Tajawal_700Bold",
                  },
                ]}
                textAlign="center"
              />
            ))}
          </Animated.View>
          {errorMsg ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.error }]}>
              {errorMsg}
            </ThemedText>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350).duration(400)} style={styles.buttonSection}>
          <Button onPress={handleVerify} disabled={isLoading} style={styles.verifyBtn}>
            {isLoading ? "جاري التحقق..." : "تأكيد الرمز"}
          </Button>

          <View style={styles.resendRow}>
            {countdown > 0 ? (
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                إعادة الإرسال بعد{" "}
                <ThemedText type="small" style={{ color: theme.primary, fontWeight: "700" }}>
                  {countdown} ثانية
                </ThemedText>
              </ThemedText>
            ) : (
              <Pressable onPress={handleResend} disabled={isResending}>
                <ThemedText type="small" style={[styles.resendBtn, { color: isResending ? theme.textSecondary : theme.primary }]}>
                  {isResending ? "جاري الإرسال..." : "إعادة إرسال الرمز"}
                </ThemedText>
              </Pressable>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(500).duration(400)} style={[styles.hint, { backgroundColor: addAlpha(theme.primary, 0.06), borderColor: addAlpha(theme.primary, 0.2) }]}>
          <Feather name="info" size={14} color={theme.primary} style={{ marginLeft: 6 }} />
          <ThemedText type="caption" style={{ color: theme.textSecondary, flex: 1, textAlign: "right" }}>
            ابحث عن رسالة من بوت تيليغرام تحتوي على الرمز المكوّن من 6 أرقام
          </ThemedText>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.xl },
  header: { alignItems: "center", marginBottom: Spacing["2xl"] },
  iconBubble: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: Spacing.xl },
  title: { fontWeight: "800", textAlign: "center", marginBottom: Spacing.sm },
  subtitle: { textAlign: "center" },
  phone: { fontWeight: "700", fontSize: 20, marginTop: 4 },
  channelNote: { marginTop: 4, textAlign: "center" },
  otpRow: { flexDirection: "row", justifyContent: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  otpInput: {
    width: 48,
    height: 58,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: "700",
  },
  errorText: { textAlign: "center", marginBottom: Spacing.sm, color: "red" },
  buttonSection: { marginTop: Spacing.xl },
  verifyBtn: { marginBottom: Spacing.lg },
  resendRow: { alignItems: "center", paddingVertical: Spacing.sm },
  resendBtn: { fontWeight: "600", textDecorationLine: "underline" },
  hint: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.sm, borderWidth: 1, marginTop: Spacing["2xl"] },
});
