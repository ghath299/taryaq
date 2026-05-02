import React, { useState, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { GlowingSearchBar } from "@/components/GlowingSearchBar";
import { useTheme } from "@/hooks/useTheme";
import { doctors, specialties } from "@/data/mockData";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

type SearchResult = { id: string; type: "doctor" | "specialty"; titleAr: string; subtitleAr?: string };

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const doctorResults: SearchResult[] = doctors
      .filter((d) => d.nameAr.includes(q) || d.specialtyAr.includes(q) || d.provinceAr.includes(q))
      .map((d) => ({ id: d.id, type: "doctor" as const, titleAr: d.nameAr, subtitleAr: `${d.specialtyAr} • ${d.provinceAr}` }));
    const specialtyResults: SearchResult[] = specialties
      .filter((s) => s.nameAr.includes(q) || s.nameEn.toLowerCase().includes(q))
      .map((s) => ({ id: s.id, type: "specialty" as const, titleAr: s.nameAr, subtitleAr: s.nameEn }));
    return [...doctorResults, ...specialtyResults].slice(0, 20);
  }, [query]);

  const recentSearches = ["طب عام", "طب أطفال", "د. أحمد", "بغداد"];

  const handleResultPress = (result: SearchResult) => {
    if (result.type === "doctor") {
      router.push(`/doctor/${result.id}`);
    }
  };

  const renderResult = ({ item, index }: { item: SearchResult; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 40).duration(250)}>
      <Pressable
        onPress={() => handleResultPress(item)}
        style={[styles.resultItem, { backgroundColor: isDark ? theme.card : "#FFF" }]}
      >
        <View style={styles.resultLeft}>
          <Feather name="chevron-left" size={16} color={theme.textSecondary} />
        </View>
        <View style={styles.resultInfo}>
          <ThemedText type="body" style={{ fontWeight: "600", textAlign: "right" }}>{item.titleAr}</ThemedText>
          {item.subtitleAr ? (
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "right" }}>{item.subtitleAr}</ThemedText>
          ) : null}
        </View>
        <View style={[styles.resultIcon, { backgroundColor: addAlpha(theme.primary, 0.1) }]}>
          <Feather name={item.type === "doctor" ? "user" : "activity"} size={18} color={theme.primary} />
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 12) }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <GlowingSearchBar value={query} onChangeText={setQuery} placeholder="ابحث عن طبيب أو تخصص..." autoFocus />
        </View>
      </View>

      {!query.trim() ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.suggestionsSection}>
          <ThemedText type="small" style={[styles.sectionLabel, { color: theme.textSecondary }]}>البحث الأخير</ThemedText>
          <View style={styles.chipsRow}>
            {recentSearches.map((s) => (
              <Pressable key={s} onPress={() => setQuery(s)} style={[styles.suggestionChip, { backgroundColor: addAlpha(theme.primary, 0.08), borderColor: addAlpha(theme.primary, 0.2) }]}>
                <Feather name="clock" size={12} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.text, marginRight: 4 }}>{s}</ThemedText>
              </Pressable>
            ))}
          </View>
          <ThemedText type="small" style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: Spacing.xl }]}>التخصصات</ThemedText>
          <View style={styles.chipsRow}>
            {specialties.slice(0, 6).map((s) => (
              <Pressable key={s.id} onPress={() => setQuery(s.nameAr)} style={[styles.suggestionChip, { backgroundColor: addAlpha(theme.primaryDark, 0.08), borderColor: addAlpha(theme.primaryDark, 0.2) }]}>
                <Feather name="activity" size={12} color={theme.primaryDark} />
                <ThemedText type="small" style={{ color: theme.text, marginRight: 4 }}>{s.nameAr}</ThemedText>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderResult}
          contentContainerStyle={[styles.resultsList, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!results.length}
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Feather name="search" size={40} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.lg }}>
                لا توجد نتائج لـ "{query}"
              </ThemedText>
            </View>
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, gap: Spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  suggestionsSection: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  sectionLabel: { textAlign: "right", marginBottom: Spacing.sm, fontWeight: "600" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, justifyContent: "flex-end" },
  suggestionChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1 },
  resultsList: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.xs },
  resultItem: { flexDirection: "row-reverse" as const, alignItems: "center", padding: Spacing.lg, borderRadius: BorderRadius.xl, gap: Spacing.md },
  resultIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  resultInfo: { flex: 1 },
  resultLeft: { flexShrink: 0 },
  noResults: { alignItems: "center", paddingTop: 60 },
});
