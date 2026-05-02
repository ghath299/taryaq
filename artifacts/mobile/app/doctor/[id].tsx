import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";
import { doctors } from "@/data/mockData";

const BALY_PACKAGE = "iq.baly.consumer";
const BALY_PLAY_STORE = `https://play.google.com/store/apps/details?id=${BALY_PACKAGE}`;
const BALY_PLAY_SEARCH = "https://play.google.com/store/search?q=baly%20iraq&c=apps";
const BALY_APP_STORE_SEARCH = "https://apps.apple.com/iq/search?term=baly";

const openBaly = async (lat: number, lng: number, name: string) => {
  const dname = encodeURIComponent(name);

  // Try to read user's current position to pass as pickup (best effort, optional)
  let origin = "";
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getLastKnownPositionAsync();
      const final =
        loc ||
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));
      if (final?.coords) {
        origin = `&slat=${final.coords.latitude}&slng=${final.coords.longitude}`;
      }
    }
  } catch {}

  const query = `dlat=${lat}&dlng=${lng}&dname=${dname}${origin}`;

  // Possible deep-link schemes Baly might register on the device
  const schemeCandidates = [
    `baly://ride?${query}`,
    `balyiq://ride?${query}`,
    `balyconsumer://ride?${query}`,
    `iq.baly.consumer://ride?${query}`,
  ];

  if (Platform.OS === "android") {
    // Use Android Intent URL: opens the Baly app if installed, otherwise Play Store
    const intentUrl =
      `intent://ride?${query}` +
      `#Intent;scheme=baly;package=${BALY_PACKAGE};` +
      `S.browser_fallback_url=${encodeURIComponent(BALY_PLAY_STORE)};end`;
    try {
      await Linking.openURL(intentUrl);
      return;
    } catch {}

    for (const url of schemeCandidates) {
      try {
        const can = await Linking.canOpenURL(url);
        if (can) {
          await Linking.openURL(url);
          return;
        }
      } catch {}
    }
    try {
      await Linking.openURL(BALY_PLAY_STORE);
    } catch {
      await Linking.openURL(BALY_PLAY_SEARCH);
    }
    return;
  }

  // iOS: try each candidate scheme; if none registered, open App Store search
  for (const url of schemeCandidates) {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return;
      }
    } catch {}
  }
  await Linking.openURL(BALY_APP_STORE_SEARCH);
};

const openWaze = (lat: number, lng: number) => {
  const deep = `waze://?ll=${lat},${lng}&navigate=yes`;
  const web = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  Linking.openURL(deep).catch(() => Linking.openURL(web).catch(() => {}));
};

export default function DoctorDetailScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const doctor = doctors.find((d) => d.id === id);

  if (!doctor) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText type="h3" style={{ textAlign: "center" }}>الطبيب غير موجود</ThemedText>
        <Button onPress={() => router.back()} style={{ marginTop: Spacing["2xl"] }}>رجوع</Button>
      </View>
    );
  }

  const shadow = Platform.select({
    ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
    android: { elevation: 8 },
    default: {},
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(300)}>
          <LinearGradient
            colors={isDark ? [addAlpha(theme.primary, 0.18), theme.backgroundRoot] : [addAlpha(theme.primary, 0.14), theme.backgroundRoot]}
            style={styles.hero}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.profileSection}>
          <View style={[styles.avatarWrap, shadow]}>
            <View style={[styles.avatarRing, { borderColor: theme.backgroundRoot }]}>
              <View style={[styles.avatar, { backgroundColor: addAlpha(theme.primary, 0.08) }]}>
                <Feather name="user" size={64} color={theme.primary} />
              </View>
            </View>
            {doctor.isVerified && (
              <View style={[styles.verifiedBadge, { backgroundColor: theme.primary, borderColor: theme.backgroundRoot }]}>
                <Feather name="check" size={12} color="#FFF" />
              </View>
            )}
          </View>

          <ThemedText type="h2" style={[styles.nameText, { color: theme.text }]}>{doctor.nameAr}</ThemedText>
          <ThemedText type="body" style={[styles.specialtyText, { color: theme.primary }]}>{doctor.specialtyAr}</ThemedText>

          <View style={styles.badgesRow}>
            <View style={[styles.badge, { backgroundColor: addAlpha("#FFCC00", 0.15) }]}>
              <Feather name="star" size={14} color="#FFCC00" />
              <ThemedText type="small" style={{ color: "#FFCC00", fontWeight: "700", marginRight: 4 }}>{doctor.rating}</ThemedText>
            </View>
            <View style={[styles.badge, { backgroundColor: addAlpha(theme.primary, 0.1) }]}>
              <Feather name="navigation" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginRight: 4 }}>{doctor.distance} كم</ThemedText>
            </View>
            {doctor.isVerified && (
              <View style={[styles.badge, { backgroundColor: addAlpha("#4CD964", 0.12) }]}>
                <Feather name="shield" size={14} color="#4CD964" />
                <ThemedText type="small" style={{ color: "#4CD964", marginRight: 4 }}>معتمد</ThemedText>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={[styles.infoCard, { backgroundColor: isDark ? theme.card : "#FFF" }]}>
          <View style={styles.cardHeader}>
            <Feather name="map-pin" size={18} color={theme.primary} />
            <ThemedText type="h4" style={{ color: theme.text, fontWeight: "700", marginRight: Spacing.sm }}>العنوان والتواصل</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText type="body" style={{ color: theme.text, textAlign: "right", flex: 1 }}>{doctor.clinicAddress}</ThemedText>
            <Feather name="map-pin" size={16} color={theme.textSecondary} style={{ marginLeft: 6 }} />
          </View>
          <View style={styles.infoRow}>
            <ThemedText type="body" style={{ color: theme.text, textAlign: "right", flex: 1 }}>{doctor.provinceAr} • {doctor.districtAr}</ThemedText>
            <Feather name="globe" size={16} color={theme.textSecondary} style={{ marginLeft: 6 }} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={[styles.infoCard, { backgroundColor: isDark ? theme.card : "#FFF" }]}>
          <View style={styles.cardHeader}>
            <Feather name="clock" size={18} color={theme.primary} />
            <ThemedText type="h4" style={{ color: theme.text, fontWeight: "700", marginRight: Spacing.sm }}>ساعات وأيام الدوام</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText type="body" style={{ color: theme.text, textAlign: "right", flex: 1 }}>{doctor.workingHours}</ThemedText>
            <Feather name="clock" size={16} color={theme.textSecondary} style={{ marginLeft: 6 }} />
          </View>
          <View style={styles.daysRow}>
            {doctor.workingDays.map((day) => (
              <View key={day} style={[styles.dayChip, { backgroundColor: addAlpha(theme.primary, 0.1), borderColor: addAlpha(theme.primary, 0.2) }]}>
                <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "600" }}>{day}</ThemedText>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(380).duration(400)} style={[styles.infoCard, { backgroundColor: isDark ? theme.card : "#FFF" }]}>
          <View style={styles.cardHeader}>
            <Feather name="navigation" size={18} color={theme.primary} />
            <ThemedText type="h4" style={{ color: theme.text, fontWeight: "700", marginRight: Spacing.sm }}>الوصول للعيادة</ThemedText>
          </View>
          <View style={styles.travelBtnRow}>
            <Pressable
              onPress={() => openWaze(doctor.lat, doctor.lng)}
              style={[
                styles.wazeBtn,
                { flex: 1, backgroundColor: addAlpha(theme.primary, 0.1), borderColor: addAlpha(theme.primary, 0.2) },
              ]}
            >
              <Feather name="navigation" size={18} color={theme.primary} />
              <ThemedText
                type="body"
                style={{ color: theme.primary, fontWeight: "600", marginRight: Spacing.sm }}
              >
                فتح في Waze
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => openBaly(doctor.lat, doctor.lng, doctor.nameAr || "العيادة")}
              style={[
                styles.wazeBtn,
                { flex: 1, backgroundColor: "#1A1AFF", borderColor: "#1A1AFF" },
              ]}
            >
              <MaterialCommunityIcons name="taxi" size={18} color="#FFF" />
              <ThemedText
                type="body"
                style={{ color: "#FFF", fontWeight: "700", marginRight: Spacing.sm }}
              >
                طلب تكسي Baly
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      <Animated.View entering={FadeInUp.delay(300).duration(300)} style={[styles.bookingFooter, { paddingBottom: insets.bottom + Spacing.lg, backgroundColor: isDark ? theme.card : "#FFF", borderTopColor: theme.border }]}>
        <Button onPress={() => router.push(`/book/${doctor.id}`)} style={{ flex: 1 }}>
          احجز موعداً الآن
        </Button>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { height: 180 },
  profileSection: { alignItems: "center", marginTop: -70, paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  avatarWrap: { marginBottom: Spacing.lg },
  avatarRing: { borderWidth: 4, borderRadius: 58, overflow: "hidden" },
  avatar: { width: 100, height: 100, alignItems: "center", justifyContent: "center" },
  verifiedBadge: { position: "absolute", bottom: 4, right: 4, width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  nameText: { fontWeight: "800", textAlign: "center", marginBottom: 4 },
  specialtyText: { marginBottom: Spacing.md },
  badgesRow: { flexDirection: "row", gap: Spacing.sm, justifyContent: "center" },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full },
  infoCard: { marginHorizontal: Spacing.xl, marginBottom: Spacing.md, borderRadius: BorderRadius.xl, padding: Spacing.xl },
  cardHeader: { flexDirection: "row-reverse" as const, alignItems: "center", marginBottom: Spacing.lg },
  infoRow: { flexDirection: "row-reverse" as const, alignItems: "center", marginBottom: Spacing.md },
  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, justifyContent: "flex-end" },
  dayChip: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full, borderWidth: 1 },
  wazeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 48, borderRadius: BorderRadius.lg, borderWidth: 1, gap: Spacing.sm },
  travelBtnRow: { flexDirection: "row", gap: Spacing.sm },
  bookingFooter: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, borderTopWidth: 1 },
});
