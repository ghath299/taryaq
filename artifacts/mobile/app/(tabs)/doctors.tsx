import React, { useState, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { GlowingSearchBar } from "@/components/GlowingSearchBar";
import { EmptyState } from "@/components/EmptyState";
import { AnimatedCard } from "@/components/AnimatedCard";
import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/contexts/AppContext";
import { doctors, specialties, provinces } from "@/data/mockData";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

export default function DoctorsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { t } = useApp();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const matchSearch = !search || doc.nameAr.includes(search) || doc.specialtyAr.includes(search);
      const matchSpecialty = !selectedSpecialty || doc.specialtyId === selectedSpecialty;
      const matchProvince = !selectedProvince || doc.provinceId === selectedProvince;
      return matchSearch && matchSpecialty && matchProvince;
    });
  }, [search, selectedSpecialty, selectedProvince]);

  const hasFilters = selectedSpecialty || selectedProvince;

  const renderDoctor = ({ item, index }: { item: (typeof doctors)[0]; index: number }) => (
    <AnimatedCard
      index={index}
      onPress={() => router.push(`/doctor/${item.id}`)}
      style={styles.doctorCard}
    >
      <View style={styles.doctorCardInner}>
        <View style={styles.doctorLeft}>
          <View style={[styles.avatar, { backgroundColor: addAlpha(theme.primary, 0.08) }]}>
            <Feather name="user" size={28} color={theme.primary} />
            {item.isVerified && (
              <View style={[styles.verifiedBadge, { backgroundColor: theme.primary }]}>
                <Feather name="check" size={8} color="#FFF" />
              </View>
            )}
          </View>
          <View style={[styles.ratingBadge, { backgroundColor: addAlpha("#FFCC00", 0.15) }]}>
            <Feather name="star" size={11} color="#FFCC00" />
            <ThemedText type="caption" style={{ color: "#FFCC00", fontWeight: "700", marginRight: 2 }}>
              {item.rating}
            </ThemedText>
          </View>
        </View>
        <View style={styles.doctorInfo}>
          <ThemedText type="h4" style={styles.doctorName} numberOfLines={1}>{item.nameAr}</ThemedText>
          <View style={styles.specialtyRow}>
            <ThemedText type="small" style={[styles.specialtyTag, { backgroundColor: addAlpha(theme.primary, 0.1), color: theme.primary }]}>
              {item.specialtyAr}
            </ThemedText>
          </View>
          <View style={styles.locationRow}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>{item.provinceAr} • {item.districtAr}</ThemedText>
            <View style={styles.distanceRow}>
              <Feather name="navigation" size={10} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginRight: 2 }}>
                {item.distance} {t("km")}
              </ThemedText>
            </View>
          </View>
          <View style={styles.workHoursRow}>
            <Feather name="clock" size={11} color={theme.primary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginRight: 4 }} numberOfLines={1}>
              {item.workingHours}
            </ThemedText>
          </View>
        </View>
        <View style={styles.arrowContainer}>
          <Feather name="chevron-left" size={18} color={theme.textSecondary} />
        </View>
      </View>
    </AnimatedCard>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <Animated.View entering={FadeIn.duration(300)} style={[styles.searchSection, { paddingTop: insets.top + 10 }]}>
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <GlowingSearchBar value={search} onChangeText={setSearch} placeholder="ابحث باسم الطبيب أو التخصص" />
          </View>
          <Pressable
            onPress={() => setShowFilters(true)}
            style={[
              styles.filterBtn,
              {
                backgroundColor: hasFilters ? theme.primary : (isDark ? theme.card : "#FFF"),
                borderColor: hasFilters ? theme.primary : theme.border,
              },
            ]}
          >
            <Feather name="sliders" size={18} color={hasFilters ? "#FFF" : theme.text} />
            {hasFilters ? (
              <View style={[styles.filterDot, { backgroundColor: isDark ? "#000" : "#FFF" }]} />
            ) : null}
          </Pressable>
        </View>
        {hasFilters ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.activeFilters}>
            {selectedSpecialty ? (
              <Pressable
                style={[styles.filterChip, { backgroundColor: addAlpha(theme.primary, 0.1), borderColor: addAlpha(theme.primary, 0.3) }]}
                onPress={() => setSelectedSpecialty(null)}
              >
                <Feather name="x" size={12} color={theme.primary} />
                <ThemedText type="caption" style={{ color: theme.primary, marginRight: 4 }}>
                  {specialties.find((s) => s.id === selectedSpecialty)?.nameAr}
                </ThemedText>
              </Pressable>
            ) : null}
            {selectedProvince ? (
              <Pressable
                style={[styles.filterChip, { backgroundColor: addAlpha(theme.primary, 0.1), borderColor: addAlpha(theme.primary, 0.3) }]}
                onPress={() => setSelectedProvince(null)}
              >
                <Feather name="x" size={12} color={theme.primary} />
                <ThemedText type="caption" style={{ color: theme.primary, marginRight: 4 }}>
                  {provinces.find((p) => p.id === selectedProvince)?.nameAr}
                </ThemedText>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
        <ThemedText type="small" style={[styles.countText, { color: theme.textSecondary }]}>
          {filteredDoctors.length} طبيب
        </ThemedText>
      </Animated.View>

      <FlatList
        data={filteredDoctors}
        keyExtractor={(item) => item.id}
        renderItem={renderDoctor}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 20 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!filteredDoctors.length}
        ListEmptyComponent={
          <EmptyState icon="user-x" title={t("emptyDoctors")} description="حاول تغيير عوامل البحث أو الفلاتر" actionLabel={hasFilters ? "مسح الفلاتر" : undefined} onAction={() => { setSelectedSpecialty(null); setSelectedProvince(null); setSearch(""); }} />
        }
      />

      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFilters(false)} />
        <View style={[styles.filterSheet, { backgroundColor: isDark ? theme.card : "#FFF" }]}>
          <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
          <View style={styles.sheetHeader}>
            <ThemedText type="h3" style={{ fontWeight: "700" }}>تصفية النتائج</ThemedText>
            <Pressable onPress={() => { setSelectedSpecialty(null); setSelectedProvince(null); }}>
              <ThemedText type="small" style={{ color: theme.primary }}>مسح الكل</ThemedText>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
            <ThemedText type="small" style={[styles.filterSectionTitle, { color: theme.textSecondary }]}>التخصص</ThemedText>
            <View style={styles.chipGrid}>
              {specialties.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedSpecialty(selectedSpecialty === s.id ? null : s.id)}
                  style={[styles.chip, {
                    backgroundColor: selectedSpecialty === s.id ? theme.primary : addAlpha(theme.primary, 0.08),
                    borderColor: selectedSpecialty === s.id ? theme.primary : addAlpha(theme.primary, 0.2),
                  }]}
                >
                  <ThemedText type="small" style={{ color: selectedSpecialty === s.id ? "#FFF" : theme.text }}>{s.nameAr}</ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText type="small" style={[styles.filterSectionTitle, { color: theme.textSecondary }]}>المحافظة</ThemedText>
            <View style={styles.chipGrid}>
              {provinces.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedProvince(selectedProvince === p.id ? null : p.id)}
                  style={[styles.chip, {
                    backgroundColor: selectedProvince === p.id ? theme.primary : addAlpha(theme.primary, 0.08),
                    borderColor: selectedProvince === p.id ? theme.primary : addAlpha(theme.primary, 0.2),
                  }]}
                >
                  <ThemedText type="small" style={{ color: selectedProvince === p.id ? "#FFF" : theme.text }}>{p.nameAr}</ThemedText>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View style={[styles.sheetActions, { borderTopColor: theme.border }]}>
            <Pressable onPress={() => setShowFilters(false)} style={[styles.applyBtn, { backgroundColor: theme.primary }]}>
              <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700" }}>عرض النتائج ({filteredDoctors.length})</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  searchSection: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, gap: Spacing.sm },
  searchRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "center" },
  filterBtn: { width: 52, height: 52, borderRadius: BorderRadius.sm, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  filterDot: { position: "absolute", top: 6, left: 6, width: 8, height: 8, borderRadius: 4 },
  activeFilters: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  filterChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full, borderWidth: 1 },
  countText: { textAlign: "right" },
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
  doctorCard: {},
  doctorCardInner: { flexDirection: "row", alignItems: "center", padding: Spacing.lg, gap: Spacing.md },
  doctorLeft: { alignItems: "center", gap: Spacing.xs },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  verifiedBadge: { position: "absolute", bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  ratingBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  doctorInfo: { flex: 1 },
  doctorName: { textAlign: "right", fontWeight: "700", marginBottom: 4 },
  specialtyRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 },
  specialtyTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 12 },
  locationRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  distanceRow: { flexDirection: "row", alignItems: "center" },
  workHoursRow: { flexDirection: "row", alignItems: "center" },
  arrowContainer: { paddingRight: 4 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  filterSheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xl, maxHeight: "80%" },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: Spacing.xl },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xl },
  filterSectionTitle: { textAlign: "right", marginBottom: Spacing.sm, fontWeight: "600" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.xl, justifyContent: "flex-end" },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, borderWidth: 1 },
  sheetActions: { borderTopWidth: 1, paddingTop: Spacing.lg },
  applyBtn: { height: 52, borderRadius: BorderRadius.lg, alignItems: "center", justifyContent: "center" },
});
