import React, { useState, useRef } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

function validateTripleName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "يرجى إدخال اسمك الثلاثي";
  if (/\d/.test(trimmed)) return "يرجى إدخال اسم ثلاثي صحيح";
  if (/[@#$%*!؟^&()=[\]{}<>|\\]/.test(trimmed)) return "يرجى إدخال اسم ثلاثي صحيح";

  const words = trimmed.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length < 3) return "يرجى إدخال اسم ثلاثي صحيح";

  if (words.some((w) => /^(.)\1+$/u.test(w))) return "يرجى إدخال اسم ثلاثي صحيح";

  const lower = words.map((w) => w.toLowerCase());
  if (new Set(lower).size === 1) return "يرجى إدخال اسم ثلاثي صحيح";

  return "";
}

export default function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { completeProfile } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const inputBg = isDark ? "#161B22" : "#F7F8FB";
  const inputBorder = isDark ? "#21262D" : "#EFEFEF";
  const buttonColor = "#1F40C8";
  const titleColor = isDark ? "#5EDFFF" : "#1F40C8";

  const handleSubmit = async () => {
    const err = validateTripleName(name);
    if (err) {
      setErrorMsg(err);
      return;
    }
    setIsLoading(true);
    try {
      await completeProfile(name.trim());
      router.replace("/(tabs)");
    } catch {
      setErrorMsg("حدث خطأ، حاول مرة أخرى");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: isDark ? "#0A0F1A" : "#FFFFFF" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: Platform.OS === "web" ? 72 : 32, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(500)} style={styles.iconSection}>
            <LinearGradient
              colors={[theme.primary, theme.primaryDark]}
              style={styles.iconBubble}
            >
              <Feather name="user" size={42} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(100).duration(500)} style={styles.textSection}>
            <ThemedText style={[styles.title, { color: theme.text, fontFamily: "Cairo-Regular" }]}>
              أكمل ملفك الشخصي
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary, fontFamily: "Cairo-Regular" }]}>
              أدخل اسمك الثلاثي ليتعرف عليك الأطباء والصيادلة
            </ThemedText>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(220).duration(500)} style={styles.formSection}>
            <View style={styles.fieldGroup}>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: inputBg,
                    borderColor: errorMsg ? theme.error : inputBorder,
                  },
                ]}
              >
                <TextInput
                  ref={inputRef}
                  value={name}
                  onChangeText={(t) => {
                    setName(t);
                    if (errorMsg) setErrorMsg("");
                  }}
                  placeholder="مثال: أحمد محمد علي"
                  placeholderTextColor={isDark ? "#6C757D" : "#A0A8B5"}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  autoFocus
                  style={[
                    styles.input,
                    { color: theme.text, fontFamily: "Cairo-Regular" },
                  ]}
                  textAlign="right"
                />
              </View>
              {errorMsg ? (
                <ThemedText style={[styles.errorText, { color: theme.error, fontFamily: "Cairo-Regular" }]}>
                  {errorMsg}
                </ThemedText>
              ) : null}
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.submitButton,
                {
                  backgroundColor: buttonColor,
                  opacity: isLoading ? 0.7 : pressed ? 0.88 : 1,
                },
              ]}
            >
              <ThemedText style={[styles.submitText, { fontFamily: "Cairo-Regular" }]}>
                {isLoading ? "جاري الحفظ..." : "متابعة"}
              </ThemedText>
            </Pressable>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(360).duration(500)}
            style={[
              styles.hintBox,
              {
                backgroundColor: addAlpha(theme.primary, 0.06),
                borderColor: addAlpha(theme.primary, 0.2),
              },
            ]}
          >
            <Feather name="info" size={14} color={titleColor} style={{ marginLeft: 8 }} />
            <ThemedText
              style={[styles.hintText, { color: theme.textSecondary, fontFamily: "Cairo-Regular" }]}
            >
              يجب أن يحتوي الاسم على ثلاث كلمات على الأقل، بدون أرقام أو رموز
            </ThemedText>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
  },
  iconSection: {
    marginBottom: Spacing["2xl"],
  },
  iconBubble: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  textSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: Spacing.sm,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
  },
  formSection: {
    width: "100%",
    marginBottom: Spacing.xl,
  },
  fieldGroup: {
    marginBottom: Spacing.md,
  },
  inputWrapper: {
    height: 58,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  errorText: {
    textAlign: "right",
    marginTop: 6,
    fontSize: 13,
  },
  submitButton: {
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  hintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    width: "100%",
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "right",
  },
});
