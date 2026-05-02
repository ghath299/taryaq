import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

export default function MedicinesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View entering={FadeIn.duration(400)} style={[styles.content, { paddingTop: insets.top + 20 }]}>
        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.iconContainer}>
          <LinearGradient colors={[theme.primary, theme.primaryDark]} style={styles.iconGradient}>
            <Feather name="package" size={56} color="#FFF" />
          </LinearGradient>
          <View style={[styles.badge, { backgroundColor: addAlpha(theme.warning, 0.15), borderColor: addAlpha(theme.warning, 0.3) }]}>
            <Feather name="clock" size={12} color={theme.warning} />
            <ThemedText type="caption" style={{ color: theme.warning, marginRight: 4, fontWeight: "700" }}>قريباً</ThemedText>
          </View>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.textContainer}>
          <ThemedText type="h1" style={[styles.title, { color: theme.text }]}>العلاجات والأدوية</ThemedText>
          <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
            قريباً ستتمكن من البحث عن الأدوية والعلاجات، والتحقق من توفرها في الصيدليات القريبة منك
          </ThemedText>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(350).duration(400)} style={styles.featuresRow}>
          {[
            { icon: "search" as const, text: "بحث بالاسم" },
            { icon: "map-pin" as const, text: "توفر قريب" },
            { icon: "truck" as const, text: "توصيل منزلي" },
          ].map((f) => (
            <View key={f.text} style={[styles.featureItem, { backgroundColor: addAlpha(theme.primary, 0.08) }]}>
              <Feather name={f.icon} size={22} color={theme.primary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4, textAlign: "center" }}>{f.text}</ThemedText>
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing["2xl"] },
  iconContainer: { alignItems: "center", marginBottom: Spacing["2xl"] },
  iconGradient: { width: 130, height: 130, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginTop: -Spacing.lg,
  },
  textContainer: { alignItems: "center", marginBottom: Spacing["2xl"] },
  title: { fontWeight: "800", textAlign: "center", marginBottom: Spacing.md },
  description: { textAlign: "center", lineHeight: 28 },
  featuresRow: { flexDirection: "row", gap: Spacing.md },
  featureItem: { flex: 1, alignItems: "center", padding: Spacing.lg, borderRadius: BorderRadius.lg },
});
