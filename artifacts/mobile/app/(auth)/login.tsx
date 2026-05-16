import React, { useState } from "react";
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
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing } from "@/constants/colors";

const lightIllustration = require("@/assets/images/doctor-consultation-light.jpeg");
const darkIllustration = require("@/assets/images/doctor-consultation-dark.jpeg");

// Glass card: real blur on iOS, styled fallback on Android
function GlassCard({ isDark, children }: { isDark: boolean; children: React.ReactNode }) {
  const overlayBg = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.55)";
  const borderColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.8)";

  if (Platform.OS === "ios") {
    return (
      <View style={styles.cardShadow}>
        <View style={[styles.glassClip, { borderColor }]}>
          <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayBg }]} />
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.cardShadow, styles.glassCardBase, { backgroundColor: overlayBg, borderColor }]}>
      {children}
    </View>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { login } = useAuth();
  const router = useRouter();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [website, setWebsite] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const scale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const validatePhone = (value: string) => {
    if (!/^07[3-9]\d{8}$/.test(value)) return "رقم الهاتف غير صحيح";
    return "";
  };

  const handleSubmit = async () => {
    const error = validatePhone(phoneNumber);
    setPhoneError(error);
    if (error) return;

    setIsLoading(true);
    try {
      await login("", phoneNumber.trim(), website);
      router.replace("/(auth)/location");
    } catch {
      Alert.alert("خطأ", "حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.");
    } finally {
      setIsLoading(false);
    }
  };

  const gradientColors = isDark
    ? (["#0a1628", "#0d2d3a", "#0891b2"] as const)
    : (["#e8f4f8", "#f0fafa", "#cce7ef"] as const);

  const titleColor = isDark ? "#5EDFFF" : "#1F40C8";
  const textColor = isDark ? "#F8F9FA" : "#0f2937";
  const secondaryColor = isDark ? "#8B95A5" : "#5a7a8a";
  const inputBg = isDark ? "rgba(10,22,40,0.6)" : "rgba(255,255,255,0.7)";
  const inputBorder = isDark ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.9)";
  const dividerColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)";
  const buttonColors = isDark
    ? (["#0891b2", "#1F40C8"] as const)
    : (["#38bdf8", "#1F40C8"] as const);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.container,
              {
                paddingTop: Platform.OS === "web" ? 64 : 24,
                paddingBottom: insets.bottom + 24,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeIn.duration(500)} style={styles.headerSection}>
              <View style={styles.titleRow}>
                <ThemedText style={[styles.appName, { color: titleColor, fontFamily: "Cairo-Regular" }]}>
                  تريـاق
                </ThemedText>
                <ThemedText style={styles.leafEmoji}>⚕️</ThemedText>
              </View>

              <ThemedText
                style={[styles.tagline, { color: secondaryColor, fontFamily: "Cairo-Regular" }]}
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

            <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.glassCardWrapper}>
              <GlassCard isDark={isDark}>
                <View style={styles.welcomeBlock}>
                  <View style={styles.welcomeRow}>
                    <ThemedText style={[styles.welcomeSmall, { color: textColor, fontFamily: "Cairo-Regular" }]}>
                      أهلاً وسهلاً بك في تريـاق
                    </ThemedText>
                    <ThemedText style={styles.welcomeLeaf}>🌿</ThemedText>
                  </View>

                  <ThemedText style={[styles.welcomeBig, { color: textColor, fontFamily: "Cairo-Regular" }]}>
                    أدخل رقم هاتفك للمتابعة
                  </ThemedText>
                </View>

                <View style={styles.form}>
                  <View style={styles.fieldGroup}>
                    <View
                      style={[
                        styles.input,
                        styles.phoneRow,
                        {
                          backgroundColor: inputBg,
                          borderColor: phoneError ? theme.error : inputBorder,
                        },
                      ]}
                    >
                      <TextInput
                        value={phoneNumber}
                        onChangeText={(t) => {
                          setPhoneNumber(t.replace(/[^0-9]/g, ""));
                          setPhoneError("");
                        }}
                        placeholder="رقم الهاتف"
                        placeholderTextColor={isDark ? "rgba(255,255,255,0.35)" : "rgba(15,41,55,0.4)"}
                        keyboardType="phone-pad"
                        maxLength={11}
                        returnKeyType="done"
                        onSubmitEditing={handleSubmit}
                        style={[
                          styles.phoneInput,
                          { color: textColor, fontFamily: "Cairo-Regular" },
                        ]}
                        textAlign="right"
                      />

                      <View style={[styles.phoneDivider, { backgroundColor: dividerColor }]} />

                      <ThemedText style={[styles.phonePrefix, { color: textColor, fontFamily: "Cairo-Regular" }]}>
                        +964
                      </ThemedText>
                    </View>

                    {phoneError ? (
                      <ThemedText style={[styles.errorText, { color: theme.error, fontFamily: "Cairo-Regular" }]}>
                        {phoneError}
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

                  <Animated.View style={animatedButtonStyle}>
                    <Pressable
                      onPress={handleSubmit}
                      disabled={isLoading}
                      onPressIn={() => {
                        scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
                      }}
                      onPressOut={() => {
                        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
                      }}
                    >
                      <LinearGradient
                        colors={buttonColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.submitButton, { opacity: isLoading ? 0.7 : 1 }]}
                      >
                        <ThemedText style={[styles.submitText, { fontFamily: "Cairo-Regular" }]}>
                          {isLoading ? "جاري المتابعة..." : "متابعة"}
                        </ThemedText>
                      </LinearGradient>
                    </Pressable>
                  </Animated.View>
                </View>

                <View style={styles.footer}>
                  <ThemedText
                    style={[styles.footerText, { color: secondaryColor, fontFamily: "Cairo-Regular" }]}
                  >
                    بالمتابعة، أنت توافق على{" "}
                    <ThemedText style={{ color: titleColor, fontFamily: "Cairo-Regular" }}>
                      الشروط والأحكام
                    </ThemedText>
                    {" "}و{" "}
                    <ThemedText style={{ color: titleColor, fontFamily: "Cairo-Regular" }}>
                      سياسة الخصوصية
                    </ThemedText>
                  </ThemedText>
                </View>
              </GlassCard>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
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
    height: 220,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  illustration: {
    width: "100%",
    height: 220,
  },
  glassCardWrapper: {
    width: "100%",
  },
  // iOS: outer shadow wrapper (no overflow — preserves shadow)
  cardShadow: {
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  // iOS: inner clip wrapper (overflow hidden — clips blur to border radius)
  glassClip: {
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.xl,
    overflow: "hidden",
  },
  // Android: single card view (no overflow:hidden — preserves elevation shadow)
  glassCardBase: {
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.xl,
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
