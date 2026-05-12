import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { addAlpha } from "@/constants/colors";

// react-native-maps is only available on native
let MapView: React.ComponentType<any> | null = null;
let Marker: React.ComponentType<any> | null = null;
let UrlTile: React.ComponentType<any> | null = null;
let Polyline: React.ComponentType<any> | null = null;
let Circle: React.ComponentType<any> | null = null;

if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
  UrlTile = maps.UrlTile;
  Polyline = maps.Polyline;
  Circle = maps.Circle;
}

// Baghdad city centre — default when location permission is denied
const BAGHDAD = { latitude: 33.3152, longitude: 44.3661 };

// Bearings (degrees) for each mock pharmacy relative to user
const PHARMACY_BEARINGS: Record<string, number> = {
  p1: 45,   // NE
  p2: 90,   // E
  p3: 135,  // SE
  p4: 270,  // W
  p5: 0,    // N
};

function offsetCoord(
  lat: number,
  lng: number,
  distanceM: number,
  bearingDeg: number,
): { latitude: number; longitude: number } {
  const R = 6371000;
  const b = (bearingDeg * Math.PI) / 180;
  const latR = (lat * Math.PI) / 180;
  const newLatR = Math.asin(
    Math.sin(latR) * Math.cos(distanceM / R) +
      Math.cos(latR) * Math.sin(distanceM / R) * Math.cos(b),
  );
  const newLngR =
    (lng * Math.PI) / 180 +
    Math.atan2(
      Math.sin(b) * Math.sin(distanceM / R) * Math.cos(latR),
      Math.cos(distanceM / R) - Math.sin(latR) * Math.sin(newLatR),
    );
  return {
    latitude: (newLatR * 180) / Math.PI,
    longitude: (newLngR * 180) / Math.PI,
  };
}

export type PharmacyStatus = "waiting" | "available" | "unavailable" | "timeout";

export interface MapPharmacy {
  id: string;
  name: string;
  address: string;
  hours: string;
  distanceM: number;
  rating: number;
  isAvailable: boolean;
  x: number;
  y: number;
  status: PharmacyStatus;
}

export interface FoundPharmacy extends MapPharmacy {
  status: "available";
  latitude: number;
  longitude: number;
}

const MOCK_PHARMACIES: MapPharmacy[] = [
  { id: "p1", name: "صيدلية الشفاء",    address: "شارع فلسطين، مقابل جامع الزهراء",       hours: "مفتوحة 24 ساعة",      distanceM: 210, rating: 4.8, isAvailable: true,  x: 0.20, y: 0.28, status: "waiting" },
  { id: "p2", name: "صيدلية الحياة",    address: "شارع الصناعة، قرب الدفاع المدني",      hours: "مفتوحة حتى 11 م",     distanceM: 340, rating: 4.5, isAvailable: true,  x: 0.78, y: 0.22, status: "waiting" },
  { id: "p3", name: "صيدلية الأمل",     address: "شارع النضال، مقابل مطعم الخليج",       hours: "مفتوحة حتى 12 ص",     distanceM: 430, rating: 4.2, isAvailable: false, x: 0.30, y: 0.78, status: "waiting" },
  { id: "p4", name: "صيدلية النور",     address: "حي الكرادة، قرب البريد",                hours: "مفتوحة حتى 10 م",     distanceM: 480, rating: 4.7, isAvailable: true,  x: 0.72, y: 0.74, status: "waiting" },
  { id: "p5", name: "صيدلية البركة",   address: "شارع الرشيد، قرب المصرف",               hours: "مفتوحة حتى 9 م",      distanceM: 490, rating: 4.3, isAvailable: true,  x: 0.50, y: 0.12, status: "waiting" },
];

const FIRST_AVAILABLE_ID = "p1";

interface Props {
  drugName: string;
  searchRadius: number;
  isSearching: boolean;
  onPharmacyFound: (pharmacy: FoundPharmacy) => void;
  showList?: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
  routeCoords?: { latitude: number; longitude: number }[] | null;
}

export default function MedicineSearchMapScreen({
  searchRadius,
  isSearching,
  onPharmacyFound,
  showList = true,
  userLocation,
  routeCoords,
}: Props) {
  const { theme, isDark } = useTheme();
  const [pharmacies, setPharmacies] = useState<MapPharmacy[]>(MOCK_PHARMACIES);
  const [foundId, setFoundId] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const radarScale   = useSharedValue(0.4);
  const radarOpacity = useSharedValue(0);
  const pinFade      = useSharedValue(0.5);
  const foundPulse   = useSharedValue(1);

  const cardBg      = isDark ? theme.card : "#FFFFFF";
  const subtleBorder = isDark ? "#21262D" : "#E5EEF5";

  // Centre the map on real user location or Baghdad fallback
  const centre = userLocation ?? BAGHDAD;

  // Compute real lat/lng for each pharmacy based on user's position
  const pharmacyCoords = useMemo(
    () =>
      MOCK_PHARMACIES.reduce<Record<string, { latitude: number; longitude: number }>>(
        (acc, p) => {
          acc[p.id] = offsetCoord(
            centre.latitude,
            centre.longitude,
            p.distanceM,
            PHARMACY_BEARINGS[p.id] ?? 0,
          );
          return acc;
        },
        {},
      ),
    [centre.latitude, centre.longitude],
  );

  useEffect(() => {
    if (!isSearching) {
      cancelAnimation(radarScale);
      cancelAnimation(radarOpacity);
      radarOpacity.value = withTiming(0, { duration: 300 });
      return;
    }

    setPharmacies(MOCK_PHARMACIES);
    setFoundId(null);
    pinFade.value = 0.5;

    radarScale.value = withRepeat(
      withTiming(1.1, { duration: 2200, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    radarOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 0 }),
        withTiming(0, { duration: 2200, easing: Easing.out(Easing.ease) }),
      ),
      -1,
      false,
    );

    pinFade.value = withDelay(400, withTiming(1, { duration: 600 }));

    const t1 = setTimeout(() => setPharmacies((prev) => prev.map((p) => p.id === "p2" ? { ...p, status: "unavailable" } : p)), 1200);
    const t2 = setTimeout(() => setPharmacies((prev) => prev.map((p) => p.id === "p3" ? { ...p, status: "unavailable" } : p)), 2000);
    const t3 = setTimeout(() => setPharmacies((prev) => prev.map((p) => p.id === "p5" ? { ...p, status: "timeout" } : p)), 2800);
    const t4 = setTimeout(() => handleFound(FIRST_AVAILABLE_ID), 3500);

    timersRef.current = [t1, t2, t3, t4];

    return () => {
      timersRef.current.forEach(clearTimeout);
      cancelAnimation(radarScale);
      cancelAnimation(radarOpacity);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearching]);

  const stopRadar = () => {
    cancelAnimation(radarScale);
    cancelAnimation(radarOpacity);
    radarOpacity.value = withTiming(0, { duration: 300 });
  };

  const handleFound = (id: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setFoundId(id);
    setPharmacies((prev) => prev.map((p) => (p.id === id ? { ...p, status: "available" } : p)));
    runOnJS(stopRadar)();
    foundPulse.value = withRepeat(
      withSequence(
        withTiming(1.7, { duration: 800, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
    const found = MOCK_PHARMACIES.find((p) => p.id === id);
    if (found) {
      const coords = pharmacyCoords[id] ?? offsetCoord(centre.latitude, centre.longitude, found.distanceM, PHARMACY_BEARINGS[id] ?? 0);
      runOnJS(onPharmacyFound)({ ...found, status: "available", ...coords });
    }
  };

  const radarStyle     = useAnimatedStyle(() => ({ transform: [{ scale: radarScale.value }], opacity: radarOpacity.value }));
  const pinFadeStyle   = useAnimatedStyle(() => ({ opacity: pinFade.value }));
  const foundPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: foundPulse.value }], opacity: 0.35 }));

  const checkedCount = useMemo(() => pharmacies.filter((p) => p.status !== "waiting").length, [pharmacies]);
  const radiusLabel  = searchRadius >= 1000
    ? `${(searchRadius / 1000).toFixed(searchRadius % 1000 === 0 ? 0 : 1)} كم`
    : `${searchRadius} متر`;

  // Delta covers ~2.5× the search radius
  const delta = Math.max((searchRadius / 111000) * 2.5, 0.005);

  const dotColor = (p: MapPharmacy) =>
    p.status === "available"   ? theme.success
    : p.status === "unavailable" ? theme.error
    : p.status === "timeout"     ? "#888"
    : theme.primaryDark;

  // ── Badge text ──────────────────────────────────────────────────────────────
  const badgeText = isSearching
    ? foundId ? "✓ وجدنا صيدلية!" : `جارٍ البحث... (${checkedCount}/${pharmacies.length})`
    : `نطاق ${radiusLabel}`;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View>
      <View style={[styles.mapWrap, { borderColor: subtleBorder }]}>

        {/* ── Native: real OpenStreetMap via react-native-maps ── */}
        {Platform.OS !== "web" && MapView && Marker && UrlTile && Circle && Polyline ? (
          <>
            <MapView
              style={StyleSheet.absoluteFillObject}
              initialRegion={{
                latitude: centre.latitude,
                longitude: centre.longitude,
                latitudeDelta: delta,
                longitudeDelta: delta,
              }}
              region={{
                latitude: centre.latitude,
                longitude: centre.longitude,
                latitudeDelta: delta,
                longitudeDelta: delta,
              }}
              rotateEnabled={false}
              pitchEnabled={false}
              scrollEnabled={false}
              zoomEnabled={false}
              showsUserLocation={false}
              showsCompass={false}
              showsScale={false}
              toolbarEnabled={false}
              liteMode={false}
            >
              {/* OpenStreetMap tiles */}
              <UrlTile
                urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
                shouldReplaceMapContent={true}
                flipY={false}
                tileCacheMaxAge={604800}
              />

              {/* Search radius circle */}
              <Circle
                center={{ latitude: centre.latitude, longitude: centre.longitude }}
                radius={searchRadius}
                strokeColor={addAlpha(theme.primary, 0.5)}
                fillColor={addAlpha(theme.primary, 0.08)}
                strokeWidth={1.5}
              />

              {/* Route polyline (delivery step) */}
              {routeCoords && routeCoords.length >= 2 && (
                <Polyline
                  coordinates={routeCoords}
                  strokeColor={theme.primaryDark}
                  strokeWidth={3.5}
                  lineDashPattern={[0]}
                />
              )}

              {/* User dot */}
              <Marker coordinate={{ latitude: centre.latitude, longitude: centre.longitude }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={styles.userDotOuter}>
                  <View style={[styles.userDotInner, { backgroundColor: theme.primaryDark }]} />
                </View>
              </Marker>

              {/* Pharmacy markers */}
              {pharmacies.map((p) => {
                const coords = pharmacyCoords[p.id];
                if (!coords) return null;
                const color = dotColor(p);
                const isFound = p.id === foundId;
                return (
                  <Marker key={p.id} coordinate={coords} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <View style={[styles.pin, { backgroundColor: color, borderWidth: isFound ? 2.5 : 0, borderColor: "#fff" }]}>
                      <MaterialCommunityIcons name="hospital-box" size={13} color="#fff" />
                    </View>
                  </Marker>
                );
              })}
            </MapView>

            {/* Radar overlay (pointer-events none) */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.radarOverlay]}>
              <View style={[styles.radarStaticRingOuter, { borderColor: addAlpha(theme.primary, 0.15) }]} />
              <View style={[styles.radarStaticRingInner, { borderColor: addAlpha(theme.primary, 0.25) }]} />
              <Animated.View
                style={[styles.radarPulse, { borderColor: theme.primary, backgroundColor: addAlpha(theme.primary, 0.07) }, radarStyle]}
              />
            </View>
          </>
        ) : (
          /* ── Web / fallback: original animated drawing ── */
          <>
            <View style={[styles.mapLand,  { backgroundColor: isDark ? "#1A2434" : "#F3F8FE" }]} />
            <View style={[styles.mapRiver, { backgroundColor: isDark ? "#0B2238" : "#CFE3F7" }]} />
            <View style={[styles.mapRoadH, { backgroundColor: isDark ? "#243149" : "#FFFFFF" }]} />
            <View style={[styles.mapRoadV, { backgroundColor: isDark ? "#243149" : "#FFFFFF" }]} />

            <View pointerEvents="none" style={styles.radarCenter}>
              <View style={[styles.radarStaticRingOuter, { borderColor: addAlpha(theme.primary, 0.15) }]} />
              <View style={[styles.radarStaticRingInner, { borderColor: addAlpha(theme.primary, 0.25) }]} />
              <Animated.View style={[styles.radarPulse, { borderColor: theme.primary, backgroundColor: addAlpha(theme.primary, 0.1) }, radarStyle]} />
              <View style={styles.userDotOuter}>
                <View style={[styles.userDotInner, { backgroundColor: theme.primaryDark }]} />
              </View>
            </View>

            {pharmacies.map((p) => {
              const isFound = p.id === foundId;
              const color   = dotColor(p);
              return (
                <Animated.View key={p.id} style={[styles.pinWrap, { left: `${p.x * 100}%`, top: `${p.y * 100}%` }, pinFadeStyle]} pointerEvents="none">
                  {isFound && <Animated.View style={[styles.pinPulse, { backgroundColor: theme.success }, foundPulseStyle]} />}
                  <View style={[styles.pin, { backgroundColor: color }]}>
                    <MaterialCommunityIcons name="hospital-box" size={13} color="#fff" />
                  </View>
                </Animated.View>
              );
            })}
          </>
        )}

        {/* Badge (always visible on top) */}
        <View style={[styles.mapBadge, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
          <ThemedText type="caption" style={{ color: theme.primaryDark, fontWeight: "800" }}>
            {badgeText}
          </ThemedText>
        </View>
      </View>

      {/* Pharmacy list */}
      {showList && (
        <View style={{ marginTop: 8 }}>
          {pharmacies.map((p) => {
            const isFound       = p.id === foundId;
            const statusColor   = p.status === "available" ? theme.success : p.status === "unavailable" ? theme.error : p.status === "timeout" ? "#888" : theme.warning;
            const statusLabel   = p.status === "available" ? "متوفر ✓" : p.status === "unavailable" ? "غير متوفر" : p.status === "timeout" ? "لم يرد" : "في الانتظار...";

            return (
              <View
                key={p.id}
                style={[
                  styles.pharmacyRow,
                  { backgroundColor: cardBg, borderColor: isFound ? theme.success : subtleBorder, borderWidth: isFound ? 1.5 : 1 },
                ]}
              >
                <View style={[styles.pharmacyDot, { backgroundColor: addAlpha(statusColor, 0.15) }]}>
                  <MaterialCommunityIcons name="hospital-box" size={18} color={statusColor} />
                </View>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <ThemedText type="small" style={{ color: theme.text, fontWeight: "800", textAlign: "right" }}>{p.name}</ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right" }}>
                    {(p.distanceM / 1000).toFixed(2)} كم · {p.hours}
                  </ThemedText>
                </View>
                <View style={[styles.statusTag, { backgroundColor: addAlpha(statusColor, 0.12) }]}>
                  <ThemedText type="caption" style={{ color: statusColor, fontWeight: "700" }}>{statusLabel}</ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 260,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#E8F0FE",
  },
  // Radar overlay centred in native map
  radarOverlay: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Web fallback drawing layers
  mapLand:  { ...StyleSheet.absoluteFillObject },
  mapRiver: { position: "absolute", top: 0, bottom: 0, left: "55%", width: "10%", transform: [{ rotate: "12deg" }], borderRadius: 100 },
  mapRoadH: { position: "absolute", left: 0, right: 0, top: "60%", height: 4, opacity: 0.85 },
  mapRoadV: { position: "absolute", top: 0, bottom: 0, left: "30%", width: 4, opacity: 0.85 },
  // Radar rings (shared web + native overlay)
  radarCenter: { position: "absolute", left: "50%", top: "50%", width: 0, height: 0, alignItems: "center", justifyContent: "center" },
  radarStaticRingOuter: { position: "absolute", width: 200, height: 200, borderRadius: 100, borderWidth: 1, transform: [{ translateX: -100 }, { translateY: -100 }] },
  radarStaticRingInner: { position: "absolute", width: 110, height: 110, borderRadius: 55,  borderWidth: 1, transform: [{ translateX: -55 },  { translateY: -55 }]  },
  radarPulse:           { position: "absolute", width: 220, height: 220, borderRadius: 110, borderWidth: 2, transform: [{ translateX: -110 }, { translateY: -110 }] },
  // User location dot
  userDotOuter: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", transform: [{ translateX: -10 }, { translateY: -10 }], shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  userDotInner: { width: 11, height: 11, borderRadius: 6 },
  // Pharmacy pins
  pinWrap:   { position: "absolute", width: 0, height: 0, alignItems: "center", justifyContent: "center" },
  pinPulse:  { position: "absolute", width: 26, height: 26, borderRadius: 13, transform: [{ translateX: -13 }, { translateY: -13 }] },
  pin:       { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
  // Badge
  mapBadge: { position: "absolute", top: 10, alignSelf: "center", left: "15%", right: "15%", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, alignItems: "center" },
  // List
  pharmacyRow:   { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, marginBottom: 8 },
  pharmacyDot:   { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statusTag:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
});
