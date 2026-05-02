import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp, ZoomIn } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { getClosestGovernorateFromCoords } from "@/lib/governorate";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

export default function LocationScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { setLocationGranted } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleGrantLocation = async () => {
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (Platform.OS === "web") {
        await setLocationGranted(undefined);
        router.replace("/(auth)/otp");
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        await setLocationGranted(undefined);
        router.replace("/(auth)/otp");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const province = getClosestGovernorateFromCoords(latitude, longitude);
      await setLocationGranted({ lat: latitude, lng: longitude, province });
      router.replace("/(auth)/otp");
    } catch (err) {
      await setLocationGranted(undefined);
      router.replace("/(auth)/otp");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    await setLocationGranted(undefined);
    router.replace("/(auth)/otp");
  };

  const features = [
    { icon: "map-pin" as const, title: "أطباء قريبون منك", desc: "اعثر على أقرب الأطباء والعيادات" },
    { icon: "navigation" as const, title: "اتجاهات فورية", desc: "احصل على تعليمات الوصول بسهولة" },
    { icon: "shield" as const, title: "خصوصية تامة", desc: "موقعك يُستخدم فقط للبحث المحلي" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={ZoomIn.duration(600)} style={styles.heroSection}>
          <LinearGradient colors={[theme.primary, theme.primaryDark]} style={styles.heroIcon}>
            <Feather name="map-pin" size={52} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.textSection}>
          <ThemedText type="h1" style={[styles.title, { color: theme.text }]}>
            تحديد موقعك
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            نستخدم موقعك لعرض أقرب الأطباء والصيدليات إليك وتوفير تجربة صحية شخصية
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350).duration(500)} style={styles.featuresSection}>
          {features.map((f, i) => (
            <Animated.View
              key={f.icon}
              entering={FadeInUp.delay(400 + i * 100).duration(400)}
              style={[styles.featureRow, { backgroundColor: isDark ? theme.card : "#FFFFFF" }]}
            >
              <View style={[styles.featureIcon, { backgroundColor: addAlpha(theme.primary, 0.1) }]}>
                <Feather name={f.icon} size={22} color={theme.primary} />
              </View>
              <View style={styles.featureText}>
                <ThemedText type="small" style={{ fontWeight: "700", textAlign: "right" }}>{f.title}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right" }}>{f.desc}</ThemedText>
              </View>
            </Animated.View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(700).duration(400)} style={styles.buttonSection}>
          <Button onPress={handleGrantLocation} disabled={isLoading} style={styles.mainBtn}>
            {isLoading ? "جاري التحديد..." : "السماح بالوصول للموقع"}
          </Button>
          <Button variant="secondary" onPress={handleSkip} style={styles.skipBtn}>
            تخطي الآن
          </Button>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: Spacing.xl, alignItems: "center" },
  heroSection: { marginBottom: Spacing["3xl"], marginTop: Spacing["2xl"] },
  heroIcon: { width: 130, height: 130, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  textSection: { alignItems: "center", marginBottom: Spacing["2xl"] },
  title: { textAlign: "center", fontWeight: "800", marginBottom: Spacing.md },
  subtitle: { textAlign: "center", lineHeight: 26 },
  featuresSection: { width: "100%", gap: Spacing.md, marginBottom: Spacing["2xl"] },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  featureIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1 },
  buttonSection: { width: "100%", gap: Spacing.md },
  mainBtn: {},
  skipBtn: {},
});
