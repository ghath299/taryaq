import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

type Segment = "medicines" | "pharmacies";

const SEGMENTS: {
  key: Segment;
  label: string;
  icon: "package" | "cross";
  title: string;
  description: string;
  features: { icon: "search" | "map-pin" | "truck" | "phone"; text: string }[];
}[] = [
  {
    key: "medicines",
    label: "العلاجات",
    icon: "package",
    title: "العلاجات والأدوية",
    description:
      "قريباً ستتمكن من البحث عن الأدوية والعلاجات، والتحقق من توفرها في الصيدليات القريبة منك",
    features: [
      { icon: "search", text: "بحث بالاسم" },
      { icon: "map-pin", text: "توفر قريب" },
      { icon: "truck", text: "توصيل منزلي" },
    ],
  },
  {
    key: "pharmacies",
    label: "الصيدليات",
    icon: "cross",
    title: "الصيدليات",
    description:
      "قريباً ستتمكن من العثور على أقرب الصيدليات إليك وطلب الأدوية مع التوصيل للمنزل",
    features: [
      { icon: "map-pin", text: "أقرب صيدلية" },
      { icon: "phone", text: "تواصل مباشر" },
      { icon: "package", text: "طلب توصيل" },
    ],
  },
];

export default function MedicinesPharmaciesScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [segment, setSegment] = useState<Segment>("medicines");

  const active = SEGMENTS.find((s) => s.key === segment)!;
  const segmentBg = isDark ? theme.card : "#FFFFFF";

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.segmentWrap, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.segmentTrack, { backgroundColor: segmentBg, borderColor: theme.border }]}>
          {SEGMENTS.map((s) => {
            const isActive = s.key === segment;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSegment(s.key)}
                style={[
                  styles.segmentBtn,
                  isActive && { backgroundColor: theme.primary },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={s.label}
              >
                <Feather
                  name={s.icon}
                  size={16}
                  color={isActive ? "#FFFFFF" : theme.textSecondary}
                />
                <ThemedText
                  type="small"
                  style={{
                    color: isActive ? "#FFFFFF" : theme.textSecondary,
                    fontWeight: "700",
                    marginRight: 6,
                  }}
                >
                  {s.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Animated.View
        key={segment}
        entering={FadeIn.duration(300)}
        style={styles.content}
      >
        <Animated.View entering={FadeInUp.delay(60).duration(360)} style={styles.iconContainer}>
          <LinearGradient colors={[theme.primary, theme.primaryDark]} style={styles.iconGradient}>
            <Feather name={active.icon} size={56} color="#FFF" />
          </LinearGradient>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: addAlpha(theme.warning, 0.15),
                borderColor: addAlpha(theme.warning, 0.3),
              },
            ]}
          >
            <Feather name="clock" size={12} color={theme.warning} />
            <ThemedText
              type="caption"
              style={{ color: theme.warning, marginRight: 4, fontWeight: "700" }}
            >
              قريباً
            </ThemedText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(140).duration(360)} style={styles.textContainer}>
          <ThemedText type="h1" style={[styles.title, { color: theme.text }]}>
            {active.title}
          </ThemedText>
          <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
            {active.description}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(240).duration(360)} style={styles.featuresRow}>
          {active.features.map((f) => (
            <View
              key={f.text}
              style={[styles.featureItem, { backgroundColor: addAlpha(theme.primary, 0.08) }]}
            >
              <Feather name={f.icon} size={22} color={theme.primary} />
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 4, textAlign: "center" }}
              >
                {f.text}
              </ThemedText>
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentWrap: {
    paddingHorizontal: Spacing["2xl"],
    paddingBottom: Spacing.md,
  },
  segmentTrack: {
    flexDirection: "row",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingBottom: Spacing["3xl"],
  },
  iconContainer: { alignItems: "center", marginBottom: Spacing["2xl"] },
  iconGradient: {
    width: 130,
    height: 130,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
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
  featureItem: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});
