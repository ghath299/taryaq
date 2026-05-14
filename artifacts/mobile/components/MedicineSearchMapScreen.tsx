import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View, StyleSheet, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { addAlpha } from "@/constants/colors";

const KARBALA_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "كربلاء",
        name_en: "Karbala Governorate",
        osm_relation: 3244381,
        admin_level: 4,
        source: "OpenStreetMap contributors © OpenStreetMap",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [43.2570076, 32.6019153],
            [43.3871422, 32.6415282],
            [43.6529917, 32.6439618],
            [43.6522894, 32.6854847],
            [43.650745, 32.7767258],
            [43.7854387, 32.7831779],
            [43.989736, 32.8469669],
            [44.0224732, 32.83908],
            [44.1394296, 32.8108977],
            [44.1872309, 32.7994408],
            [44.2101341, 32.7977434],
            [44.2105514, 32.8048151],
            [44.2186232, 32.8042775],
            [44.2149694, 32.7823427],
            [44.2148088, 32.7762119],
            [44.2149259, 32.7736163],
            [44.2205902, 32.7629417],
            [44.2197312, 32.7625315],
            [44.2291047, 32.7460738],
            [44.2287725, 32.7425294],
            [44.2317959, 32.73749],
            [44.2372544, 32.7340307],
            [44.2465601, 32.7309483],
            [44.2555153, 32.7280966],
            [44.2670911, 32.7272937],
            [44.2640013, 32.7084571],
            [44.253069, 32.7077439],
            [44.2471643, 32.6964599],
            [44.2410457, 32.6912502],
            [44.2284354, 32.6797408],
            [44.2232109, 32.6656314],
            [44.2128076, 32.6607286],
            [44.2170309, 32.6513597],
            [44.2207614, 32.6516523],
            [44.2411215, 32.6532494],
            [44.2542359, 32.6542781],
            [44.2756807, 32.6508522],
            [44.2896059, 32.644985],
            [44.2986742, 32.6397945],
            [44.3039909, 32.6343974],
            [44.3029365, 32.572809],
            [44.3016581, 32.560003],
            [44.2984883, 32.5282425],
            [44.2870046, 32.5204685],
            [44.270807, 32.5128303],
            [44.2672501, 32.5068659],
            [44.2731779, 32.4992329],
            [44.2960267, 32.4739255],
            [44.3024059, 32.4640177],
            [44.3102241, 32.4485482],
            [44.3017703, 32.4455444],
            [44.3009314, 32.4414786],
            [44.3003617, 32.4404642],
            [44.2907911, 32.4234207],
            [44.2880223, 32.4164611],
            [44.2883031, 32.4058185],
            [44.2854939, 32.4004265],
            [44.2945097, 32.3900658],
            [44.2981097, 32.3756717],
            [44.2977938, 32.3619659],
            [44.2541665, 32.3479187],
            [44.2517838, 32.3471515],
            [44.250953, 32.3468318],
            [44.0954894, 32.2899656],
            [43.7371844, 32.1587306],
            [43.2570076, 32.6019153],
          ],
        ],
      },
    },
  ],
} as const;

const KARBALA = { latitude: 32.6163, longitude: 44.0246 };

const PHARMACY_BEARINGS: Record<string, number> = {
  p1: 10,
  p2: 75,
  p3: 150,
  p4: 230,
  p5: 310,
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

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function pointInPolygon(
  lat: number,
  lng: number,
  ringCoords: readonly (readonly [number, number])[],
): boolean {
  let inside = false;

  for (let i = 0, j = ringCoords.length - 1; i < ringCoords.length; j = i++) {
    const xi = ringCoords[i][0];
    const yi = ringCoords[i][1];
    const xj = ringCoords[j][0];
    const yj = ringCoords[j][1];

    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

const KARBALA_RING = KARBALA_GEOJSON.features[0].geometry.coordinates[0];

export type PharmacyStatus =
  | "waiting"
  | "available"
  | "unavailable"
  | "timeout";

export interface MapPharmacy {
  id: string;
  name: string;
  address: string;
  distanceM: number;
  rating: number;
  isAvailable: boolean;
  status: PharmacyStatus;
}

export interface FoundPharmacy extends MapPharmacy {
  status: "available";
  latitude: number;
  longitude: number;
}

const MOCK_PHARMACIES: MapPharmacy[] = [
  {
    id: "p1",
    name: "صيدلية الحسينية",
    address: "شارع الإمام الحسين، كربلاء",
    distanceM: 280,
    rating: 4.8,
    isAvailable: true,
    status: "waiting",
  },
  {
    id: "p2",
    name: "صيدلية العباسية",
    address: "مقابل مرقد أبو الفضل العباس",
    distanceM: 420,
    rating: 4.6,
    isAvailable: true,
    status: "waiting",
  },
  {
    id: "p3",
    name: "صيدلية الشفاء",
    address: "شارع طريق النجف، كربلاء",
    distanceM: 550,
    rating: 4.3,
    isAvailable: false,
    status: "waiting",
  },
  {
    id: "p4",
    name: "صيدلية النهضة",
    address: "حي النهضة، كربلاء المقدسة",
    distanceM: 700,
    rating: 4.7,
    isAvailable: true,
    status: "waiting",
  },
  {
    id: "p5",
    name: "صيدلية باب بغداد",
    address: "شارع باب بغداد، كربلاء",
    distanceM: 860,
    rating: 4.4,
    isAvailable: true,
    status: "waiting",
  },
];

const PHARMACY_STATUS_COLORS: Record<PharmacyStatus, string> = {
  waiting: "#1F40C8",
  available: "#22C55E",
  unavailable: "#9CA3AF",
  timeout: "#CBD5E1",
};

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

  const [pharmacies, setPharmacies] =
    useState<MapPharmacy[]>(MOCK_PHARMACIES);
  const [foundId, setFoundId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const mapRef = useRef<unknown>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const radarScale = useSharedValue(0.4);
  const radarOpacity = useSharedValue(0);
  const foundPulse = useSharedValue(1);

  const cardBg = isDark ? theme.card : "#FFFFFF";
  const subtleBorder = isDark ? "#21262D" : "#E5EEF5";

  const centre = userLocation ?? KARBALA;

  const pharmacyCoords = useMemo(() => {
    return MOCK_PHARMACIES.reduce<
      Record<string, { latitude: number; longitude: number; realDistanceM: number }>
    >((acc, p) => {
      const coord = offsetCoord(
        centre.latitude,
        centre.longitude,
        p.distanceM,
        PHARMACY_BEARINGS[p.id] ?? 0,
      );

      if (!pointInPolygon(coord.latitude, coord.longitude, KARBALA_RING)) {
        return acc;
      }

      const realDistanceM = distanceMeters(centre, coord);

      acc[p.id] = {
        latitude: coord.latitude,
        longitude: coord.longitude,
        realDistanceM,
      };

      return acc;
    }, {});
  }, [centre.latitude, centre.longitude]);

  const visiblePharmacies = useMemo(() => {
    return pharmacies.filter((p) => {
      const coord = pharmacyCoords[p.id];
      if (!coord) return false;
      return coord.realDistanceM <= searchRadius;
    });
  }, [pharmacies, pharmacyCoords, searchRadius]);

  const stopRadar = useCallback(() => {
    cancelAnimation(radarScale);
    cancelAnimation(radarOpacity);
    radarOpacity.value = withTiming(0, { duration: 300 });
  }, [radarScale, radarOpacity]);

  const handleFound = useCallback(
    (id: string) => {
      const found = visiblePharmacies.find((p) => p.id === id);
      const coords = pharmacyCoords[id];

      if (!found || !coords) return;

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setFoundId(id);

      setPharmacies((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: "available" as const } : p,
        ),
      );

      stopRadar();

      foundPulse.value = withRepeat(
        withSequence(
          withTiming(1.7, { duration: 800, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      );

      onPharmacyFound({
        ...found,
        distanceM: Math.round(coords.realDistanceM),
        status: "available",
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    },
    [
      visiblePharmacies,
      pharmacyCoords,
      stopRadar,
      onPharmacyFound,
      foundPulse,
    ],
  );

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!isSearching) {
      stopRadar();
      return;
    }

    setFoundId(null);

    setPharmacies((prev) =>
      prev.map((p) => ({ ...p, status: "waiting" as const })),
    );

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

    const candidates = visiblePharmacies;

    if (candidates.length === 0) {
      stopRadar();
      return;
    }

    const update = (id: string, status: PharmacyStatus) => {
      setPharmacies((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status } : p)),
      );
    };

    candidates.forEach((p, index) => {
      const timer = setTimeout(() => {
        if (p.isAvailable) {
          handleFound(p.id);
        } else {
          update(p.id, "unavailable");
        }
      }, 1000 + index * 700);

      timersRef.current.push(timer);
    });

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      stopRadar();
    };
  }, [isSearching, visiblePharmacies, handleFound, stopRadar]);

  const radarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: radarScale.value }],
    opacity: radarOpacity.value,
  }));

  const foundPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: foundPulse.value }],
    opacity: 0.35,
  }));

  const checkedCount = visiblePharmacies.filter(
    (p) => p.status !== "waiting",
  ).length;

  const radiusLabel =
    searchRadius >= 1000
      ? `${(searchRadius / 1000).toFixed(searchRadius % 1000 === 0 ? 0 : 1)} كم`
      : `${searchRadius} متر`;

  const badgeText = isSearching
    ? foundId
      ? "✓ وجدنا صيدلية داخل النطاق"
      : `تم إشعار ${visiblePharmacies.length} صيدلية داخل ${radiusLabel}`
    : `نطاق ${radiusLabel} · كربلاء`;

  const dotColor = (p: MapPharmacy) =>
    p.status === "available"
      ? theme.success
      : p.status === "unavailable"
        ? "#9CA3AF"
        : p.status === "timeout"
          ? "#CBD5E1"
          : theme.primaryDark;

  const statusLabel = (p: MapPharmacy) =>
    p.status === "available"
      ? "متوفر ✓"
      : p.status === "unavailable"
        ? "غير متوفر"
        : p.status === "timeout"
          ? "لم يرد"
          : "داخل النطاق";

  // Suppress unused warning — kept for potential future use
  void checkedCount;
  void mapReady;

  return (
    <View>
      <View style={[styles.mapWrap, { borderColor: subtleBorder }]}>
        {Platform.OS !== "web" ? (
          <>
            {(() => {
              const Maps = require("react-native-maps");
              const MapView = Maps.default;
              const { Marker, Circle, Polyline, Polygon, PROVIDER_GOOGLE } =
                Maps;

              const karbalaCoords = (
                KARBALA_RING as readonly (readonly [number, number])[]
              ).map(([lng, lat]) => ({
                latitude: lat,
                longitude: lng,
              }));

              return (
                <MapView
                  ref={(r: unknown) => {
                    mapRef.current = r;
                  }}
                  style={StyleSheet.absoluteFillObject}
                  provider={PROVIDER_GOOGLE}
                  region={{
                    latitude: centre.latitude,
                    longitude: centre.longitude,
                    latitudeDelta: 0.04,
                    longitudeDelta: 0.04,
                  }}
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  onMapReady={() => setMapReady(true)}
                >
                  <Polygon
                    coordinates={karbalaCoords}
                    strokeColor="#1F40C8"
                    strokeWidth={2}
                    fillColor="rgba(94,223,255,0.04)"
                  />

                  <Circle
                    center={centre}
                    radius={searchRadius}
                    strokeColor="#1F40C8"
                    strokeWidth={2.4}
                    fillColor="rgba(94,223,255,0.09)"
                  />

                  <Marker
                    coordinate={centre}
                    anchor={{ x: 0.5, y: 0.5 }}
                    title="موقعك الحالي"
                  >
                    <View style={styles.userRing}>
                      <View style={styles.userDot} />
                    </View>
                  </Marker>

                  {visiblePharmacies.map((p) => {
                    const coord = pharmacyCoords[p.id];
                    if (!coord) return null;
                    const color =
                      PHARMACY_STATUS_COLORS[p.status] ??
                      PHARMACY_STATUS_COLORS.waiting;
                    const isGray =
                      p.status === "unavailable" || p.status === "timeout";
                    return (
                      <Marker
                        key={p.id}
                        coordinate={{
                          latitude: coord.latitude,
                          longitude: coord.longitude,
                        }}
                        anchor={{ x: 0.5, y: 0.5 }}
                        title={p.name}
                      >
                        <View
                          style={[
                            styles.pharmacyPin,
                            {
                              backgroundColor: color,
                              opacity: isGray ? 0.7 : 1,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="hospital-box"
                            size={13}
                            color="#fff"
                          />
                        </View>
                      </Marker>
                    );
                  })}

                  {routeCoords && routeCoords.length >= 2 && (
                    <Polyline
                      coordinates={routeCoords}
                      strokeColor="#1F40C8"
                      strokeWidth={5}
                    />
                  )}
                </MapView>
              );
            })()}

            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFillObject, styles.radarCenter]}
            >
              <View
                style={[
                  styles.staticRingOuter,
                  { borderColor: addAlpha(theme.primary, 0.16) },
                ]}
              />
              <View
                style={[
                  styles.staticRingInner,
                  { borderColor: addAlpha(theme.primary, 0.26) },
                ]}
              />
              <Animated.View
                style={[
                  styles.radarPulse,
                  {
                    borderColor: theme.primary,
                    backgroundColor: addAlpha(theme.primary, 0.05),
                  },
                  radarStyle,
                ]}
              />
            </View>
          </>
        ) : (
          <>
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: isDark ? "#1A2434" : "#E8F4FE" },
              ]}
            />
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFillObject, styles.radarCenter]}
            >
              <View
                style={[
                  styles.staticRingOuter,
                  { borderColor: addAlpha(theme.primary, 0.18) },
                ]}
              />
              <View
                style={[
                  styles.staticRingInner,
                  { borderColor: addAlpha(theme.primary, 0.28) },
                ]}
              />
              <Animated.View
                style={[
                  styles.radarPulse,
                  {
                    borderColor: theme.primary,
                    backgroundColor: addAlpha(theme.primary, 0.1),
                  },
                  radarStyle,
                ]}
              />
              <View style={styles.userDotWrap}>
                <View
                  style={[
                    styles.userDotInner,
                    { backgroundColor: theme.primaryDark },
                  ]}
                />
              </View>
            </View>

            {visiblePharmacies.map((p, i) => {
              const isFound = p.id === foundId;
              const color = dotColor(p);
              const xPct = 0.15 + (i / Math.max(visiblePharmacies.length, 1)) * 0.7;
              const yPct = 0.2 + ((i * 0.37) % 0.6);

              return (
                <View
                  key={p.id}
                  style={[
                    styles.webPinWrap,
                    {
                      left: `${xPct * 100}%` as unknown as number,
                      top: `${yPct * 100}%` as unknown as number,
                    },
                  ]}
                  pointerEvents="none"
                >
                  {isFound && (
                    <Animated.View
                      style={[
                        styles.pinPulse,
                        { backgroundColor: theme.success },
                        foundPulseStyle,
                      ]}
                    />
                  )}
                  <View style={[styles.pin, { backgroundColor: color }]}>
                    <MaterialCommunityIcons
                      name="hospital-box"
                      size={13}
                      color="#fff"
                    />
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View
          style={[
            styles.badge,
            { backgroundColor: cardBg, borderColor: subtleBorder },
          ]}
        >
          <ThemedText
            type="caption"
            style={{ color: theme.primaryDark, fontWeight: "800" }}
          >
            {badgeText}
          </ThemedText>
        </View>
      </View>

      {showList && (
        <View style={{ marginTop: 8 }}>
          {visiblePharmacies.length === 0 ? (
            <View
              style={[
                styles.emptyRow,
                { backgroundColor: cardBg, borderColor: subtleBorder },
              ]}
            >
              <MaterialCommunityIcons
                name="map-search-outline"
                size={22}
                color={theme.textSecondary}
              />
              <ThemedText
                type="small"
                style={{
                  color: theme.textSecondary,
                  textAlign: "right",
                  flex: 1,
                  marginRight: 8,
                }}
              >
                لا توجد صيدليات مسجلة داخل هذا النطاق
              </ThemedText>
            </View>
          ) : (
            visiblePharmacies.map((p) => {
              const isFound = p.id === foundId;
              const color = dotColor(p);
              const coord = pharmacyCoords[p.id];
              const distance = coord?.realDistanceM ?? p.distanceM;

              return (
                <View
                  key={p.id}
                  style={[
                    styles.pharmacyRow,
                    {
                      backgroundColor: cardBg,
                      borderColor: isFound ? theme.success : subtleBorder,
                      borderWidth: isFound ? 1.5 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.pharmacyIcon,
                      { backgroundColor: addAlpha(color, 0.15) },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="hospital-box"
                      size={18}
                      color={color}
                    />
                  </View>

                  <View style={{ flex: 1, marginRight: 10 }}>
                    <ThemedText
                      type="small"
                      style={{
                        color: theme.text,
                        fontWeight: "800",
                        textAlign: "right",
                      }}
                    >
                      {p.name}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{
                        color: theme.textSecondary,
                        textAlign: "right",
                      }}
                    >
                      {(distance / 1000).toFixed(2)} كم داخل الزون
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.statusTag,
                      { backgroundColor: addAlpha(color, 0.12) },
                    ]}
                  >
                    <ThemedText
                      type="caption"
                      style={{ color, fontWeight: "700" }}
                    >
                      {statusLabel(p)}
                    </ThemedText>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 280,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#E8F4FE",
  },

  radarCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  staticRingOuter: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    transform: [{ translateX: -100 }, { translateY: -100 }],
  },
  staticRingInner: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    transform: [{ translateX: -55 }, { translateY: -55 }],
  },
  radarPulse: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    transform: [{ translateX: -110 }, { translateY: -110 }],
  },

  userDotWrap: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    transform: [{ translateX: -10 }, { translateY: -10 }],
  },
  userDotInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },

  // Native Google Maps marker styles
  userRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(31,64,200,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  userDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#1F40C8",
    borderWidth: 3,
    borderColor: "#fff",
  },
  pharmacyPin: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.96)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 7,
    elevation: 4,
  },

  webPinWrap: {
    position: "absolute",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pinPulse: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    transform: [{ translateX: -13 }, { translateY: -13 }],
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },

  badge: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    left: "8%",
    right: "8%",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
  },

  pharmacyRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  pharmacyIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
});
