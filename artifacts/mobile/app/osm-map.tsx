import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  useColorScheme,
  TouchableOpacity,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";

// ═══════════════════════════════════════════
// الإعدادات — حط التوكن في Replit Secrets
// EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
// EXPO_PUBLIC_MAPBOX_STYLE_URL
// ═══════════════════════════════════════════
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

const MAPBOX_STYLE =
  process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? "mapbox://styles/mapbox/dark-v11";

const BRAND_BLUE = "#2563EB";
const SOFT_BG = "#F4F7FB";
const CARD_BG = "#FFFFFF";
const DARK_CARD = "#1E293B";
const DEFAULT_LAT = 33.3152;
const DEFAULT_LNG = 44.3661;

type Coords = { latitude: number; longitude: number };
type GovBoundary = { latitude: number; longitude: number }[];

const GOVERNORATE_MAP: Record<string, string> = {
  Baghdad: "بغداد",
  Basra: "البصرة",
  Nineveh: "نينوى",
  Erbil: "أربيل",
  Sulaymaniyah: "السليمانية",
  Kirkuk: "كركوك",
  Diyala: "ديالى",
  Anbar: "الأنبار",
  Babil: "بابل",
  Karbala: "كربلاء",
  Wasit: "واسط",
  "Salah ad-Din": "صلاح الدين",
  Najaf: "النجف",
  Muthanna: "المثنى",
  Qadisiyyah: "القادسية",
  "Dhi Qar": "ذي قار",
  Maysan: "ميسان",
  Dohuk: "دهوك",
  Halabja: "حلبجة",
};

// ═══════════════════════════════════════════
// الشاشة الرئيسية
// ═══════════════════════════════════════════
export default function OSMMapScreen() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [governorate, setGovernorate] = useState<string | null>(null);
  const [govBoundary, setGovBoundary] = useState<GovBoundary | null>(null);
  const [loadingBoundary, setLoadingBoundary] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // حالة الملاحة
  const [isNavigating, setIsNavigating] = useState(false);
  const [destination, setDestination] = useState<Coords | null>(null);
  const [routeCoords, setRouteCoords] = useState<Coords[]>([]);
  const [navInstruction, setNavInstruction] = useState<string>("");
  const [navDistance, setNavDistance] = useState<string>("");
  const [navTotalDist, setNavTotalDist] = useState<string>("");
  const [navTotalTime, setNavTotalTime] = useState<string>("");

  const mapRef = useRef<any>(null);
  const locationSub = useRef<any>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // تحديد الموقع + المراقبة الحية
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (mounted) setErrorMsg("لم يُسمح بالوصول إلى الموقع");
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (!mounted) return;

        const userCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setCoords(userCoords);
        if (loc.coords.heading) setHeading(loc.coords.heading);

        // تحديد المحافظة
        const geo = await Location.reverseGeocodeAsync(userCoords);
        if (geo?.[0]) {
          const regionEn = geo[0].region ?? geo[0].subregion ?? null;
          if (regionEn && mounted) {
            const regionAr = GOVERNORATE_MAP[regionEn] ?? regionEn;
            setGovernorate(regionAr);
            fetchGovernorateBoundary(
              regionEn,
              mounted,
              setGovBoundary,
              setLoadingBoundary,
            );
          }
        }

        // مراقبة الموقع الحي
        locationSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 3,
          },
          (live) => {
            if (!mounted) return;
            setCoords({
              latitude: live.coords.latitude,
              longitude: live.coords.longitude,
            });
            if (live.coords.heading !== null)
              setHeading(live.coords.heading ?? 0);
          },
        );
      } catch {
        if (mounted) setErrorMsg("تعذّر تحديد موقعك الحالي");
      }
    })();
    return () => {
      mounted = false;
      locationSub.current?.remove();
    };
  }, []);

  // حساب المسار عبر Mapbox Directions API
  const fetchRoute = useCallback(async (dest: Coords, origin: Coords) => {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?steps=true&geometries=geojson&language=ar&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.routes?.[0]) return;

      const route = data.routes[0];
      const pts: Coords[] = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng }),
      );
      setRouteCoords(pts);

      const firstStep = route.legs?.[0]?.steps?.[0];
      if (firstStep) {
        setNavInstruction(firstStep.maneuver?.instruction ?? "");
        setNavDistance(formatDistance(firstStep.distance));
      }

      setNavTotalDist(formatDistance(route.distance));
      setNavTotalTime(formatDuration(route.duration));
    } catch (e) {
      console.error("Route error:", e);
    }
  }, []);

  // بدء الملاحة
  const startNavigation = useCallback(
    (dest: Coords) => {
      if (!coords) return;
      setDestination(dest);
      setIsNavigating(true);
      fetchRoute(dest, coords);
    },
    [coords, fetchRoute],
  );

  // إيقاف الملاحة
  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    setDestination(null);
    setRouteCoords([]);
    setNavInstruction("");
    setNavDistance("");
  }, []);

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? "#0F172A" : SOFT_BG },
      ]}
      edges={["top"]}
    >
      <Stack.Screen
        options={{
          headerShown: !isNavigating,
          headerTitle: governorate
            ? `صيدليات وأطباء ${governorate}`
            : "الصيدليات والأطباء",
          headerTitleAlign: "center",
          headerBackTitle: "رجوع",
        }}
      />

      <View style={styles.mapWrap}>
        {/* ── الخريطة ── */}
        {Platform.OS === "web" ? (
          <WebMap
            coords={coords}
            isDark={isDark}
            govBoundary={govBoundary}
            isNavigating={isNavigating}
            routeCoords={routeCoords}
            heading={heading}
            destination={destination}
          />
        ) : (
          <NativeMap
            mapRef={mapRef}
            coords={coords}
            isDark={isDark}
            govBoundary={govBoundary}
            isNavigating={isNavigating}
            routeCoords={routeCoords}
            heading={heading}
            destination={destination}
          />
        )}

        {/* ── بطاقة التعليمات أثناء الملاحة (أعلى) ── */}
        {isNavigating && navInstruction ? (
          <View style={styles.instructionCard}>
            <View style={styles.instructionRow}>
              <View style={styles.turnIconWrap}>
                <Feather name="corner-up-left" size={26} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.instructionDist}>{navDistance}</Text>
                <Text style={styles.instructionText} numberOfLines={2}>
                  {navInstruction}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── بطاقة الوقت والمسافة (أسفل) أثناء الملاحة ── */}
        {isNavigating ? (
          <View style={styles.navBottomCard}>
            <View style={styles.navInfoRow}>
              <Text style={styles.navTime}>{navTotalTime}</Text>
              <Text style={styles.navDot}>·</Text>
              <Text style={styles.navDist}>{navTotalDist}</Text>
            </View>
            <TouchableOpacity style={styles.stopBtn} onPress={stopNavigation}>
              <Feather name="x" size={18} color="#fff" />
              <Text style={styles.stopText}>إيقاف</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── البطاقة العلوية (بدون ملاحة) ── */}
        {!isNavigating ? (
          <View pointerEvents="box-none" style={styles.overlayTop}>
            <View
              style={[
                styles.headerCard,
                { backgroundColor: isDark ? DARK_CARD : CARD_BG },
              ]}
            >
              <View style={styles.headerIconWrap}>
                <Feather name="map-pin" size={20} color={BRAND_BLUE} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText
                  type="h4"
                  style={[styles.headerTitle, { textAlign: "right" }]}
                >
                  {governorate
                    ? `الصيدليات والأطباء في ${governorate}`
                    : "الصيدليات والأطباء"}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={[styles.headerSubtitle, { textAlign: "right" }]}
                >
                  Mapbox داخل تطبيق ترياق
                </ThemedText>
              </View>
            </View>

            {(!coords || loadingBoundary) && !errorMsg ? (
              <View
                style={[
                  styles.statusCard,
                  { backgroundColor: isDark ? DARK_CARD : CARD_BG },
                ]}
              >
                <ActivityIndicator size="small" color={BRAND_BLUE} />
                <ThemedText type="caption" style={styles.statusText}>
                  {!coords
                    ? "جاري تحديد موقعك الحالي…"
                    : "جاري تحميل حدود المحافظة…"}
                </ThemedText>
              </View>
            ) : null}

            {errorMsg ? (
              <View
                style={[
                  styles.statusCard,
                  { backgroundColor: isDark ? DARK_CARD : CARD_BG },
                ]}
              >
                <Feather name="alert-circle" size={16} color="#DC2626" />
                <ThemedText type="caption" style={styles.statusText}>
                  {errorMsg}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── زر تجربة الملاحة (مؤقت للاختبار) ── */}
        {!isNavigating && coords ? (
          <TouchableOpacity
            style={styles.testBtn}
            onPress={() =>
              startNavigation({
                latitude: coords.latitude + 0.008,
                longitude: coords.longitude + 0.008,
              })
            }
          >
            <Feather name="navigation" size={18} color="#fff" />
            <Text style={styles.testBtnText}>تجربة الملاحة</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════
// خريطة الموبايل — Mapbox Native
// ═══════════════════════════════════════════
function NativeMap({
  mapRef,
  coords,
  isDark,
  govBoundary,
  isNavigating,
  routeCoords,
  heading,
  destination,
}: {
  mapRef: React.MutableRefObject<any>;
  coords: Coords | null;
  isDark: boolean;
  govBoundary: GovBoundary | null;
  isNavigating: boolean;
  routeCoords: Coords[];
  heading: number;
  destination: Coords | null;
}) {
  let Mapbox: any = null;
  try {
    Mapbox = require("@rnmapbox/maps");
    Mapbox.default.setAccessToken(MAPBOX_TOKEN);
  } catch {
    // Mapbox غير متوفر — fallback
    return (
      <View style={[StyleSheet.absoluteFill, styles.fallback]}>
        <ActivityIndicator color={BRAND_BLUE} />
        <Text style={{ color: "#fff", marginTop: 8 }}>جاري تحميل الخريطة…</Text>
      </View>
    );
  }

  const {
    MapView,
    Camera,
    UserLocation,
    ShapeSource,
    LineLayer,
    FillLayer,
    CircleLayer,
  } = Mapbox;

  const center = coords
    ? [coords.longitude, coords.latitude]
    : [DEFAULT_LNG, DEFAULT_LAT];

  // GeoJSON للمسار
  const routeGeoJSON =
    routeCoords.length >= 2
      ? {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: routeCoords.map((c) => [c.longitude, c.latitude]),
          },
        }
      : null;

  // GeoJSON لحدود المحافظة
  const boundaryGeoJSON =
    govBoundary && govBoundary.length > 0
      ? {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [govBoundary.map((c) => [c.longitude, c.latitude])],
          },
        }
      : null;

  // GeoJSON للوجهة
  const destGeoJSON = destination
    ? {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [destination.longitude, destination.latitude],
        },
      }
    : null;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      styleURL={MAPBOX_STYLE}
      logoEnabled={false}
      attributionEnabled={false}
      compassEnabled={!isNavigating}
      scaleBarEnabled={false}
    >
      {/* الكاميرا — وضع ملاحة: pitch 55 + تتبع الاتجاه */}
      <Camera
        zoomLevel={isNavigating ? 17.5 : 12}
        pitch={isNavigating ? 55 : 0}
        heading={isNavigating ? heading : 0}
        centerCoordinate={center}
        animationMode={isNavigating ? "flyTo" : "easeTo"}
        animationDuration={800}
      />

      {/* موقع المستخدم */}
      <UserLocation
        visible={true}
        renderMode="native"
        showsUserHeadingIndicator={true}
      />

      {/* حدود المحافظة */}
      {boundaryGeoJSON ? (
        <ShapeSource id="govSource" shape={boundaryGeoJSON as any}>
          <FillLayer
            id="govFill"
            style={{
              fillColor: BRAND_BLUE,
              fillOpacity: isDark ? 0.06 : 0.05,
            }}
          />
          <LineLayer
            id="govLine"
            style={{
              lineColor: BRAND_BLUE,
              lineWidth: 2.5,
              lineOpacity: 0.8,
            }}
          />
        </ShapeSource>
      ) : null}

      {/* خط المسار */}
      {routeGeoJSON ? (
        <ShapeSource id="routeSource" shape={routeGeoJSON as any}>
          {/* الظل */}
          <LineLayer
            id="routeShadow"
            style={{
              lineColor: "#000",
              lineWidth: 12,
              lineOpacity: 0.15,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          {/* الخط الرئيسي */}
          <LineLayer
            id="routeMain"
            style={{
              lineColor: BRAND_BLUE,
              lineWidth: 8,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          {/* الخط الداخلي الفاتح */}
          <LineLayer
            id="routeInner"
            style={{
              lineColor: "#93C5FD",
              lineWidth: 3,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </ShapeSource>
      ) : null}

      {/* علامة الوجهة */}
      {destGeoJSON ? (
        <ShapeSource id="destSource" shape={destGeoJSON as any}>
          <CircleLayer
            id="destCircle"
            style={{
              circleRadius: 12,
              circleColor: "#EF4444",
              circleStrokeColor: "#fff",
              circleStrokeWidth: 3,
            }}
          />
        </ShapeSource>
      ) : null}
    </MapView>
  );
}

// ═══════════════════════════════════════════
// خريطة الويب — Mapbox GL JS في iframe
// ═══════════════════════════════════════════
function WebMap({
  coords,
  isDark,
  govBoundary,
  isNavigating,
  routeCoords,
  heading,
  destination,
}: {
  coords: Coords | null;
  isDark: boolean;
  govBoundary: GovBoundary | null;
  isNavigating: boolean;
  routeCoords: Coords[];
  heading: number;
  destination: Coords | null;
}) {
  const center = coords ?? { latitude: DEFAULT_LAT, longitude: DEFAULT_LNG };
  const routeJSON = JSON.stringify(
    routeCoords.map((c) => [c.longitude, c.latitude]),
  );
  const boundaryJSON = govBoundary
    ? JSON.stringify(govBoundary.map((c) => [c.longitude, c.latitude]))
    : "null";
  const destJSON = destination
    ? JSON.stringify([destination.longitude, destination.latitude])
    : "null";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<script src="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.js"></script>
<link href="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.css" rel="stylesheet"/>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;}
</style>
</head>
<body>
<div id="map"></div>
<script>
mapboxgl.accessToken = '${MAPBOX_TOKEN}';

var map = new mapboxgl.Map({
  container: 'map',
  style: '${MAPBOX_STYLE}',
  center: [${center.longitude}, ${center.latitude}],
  zoom: ${isNavigating ? 17 : 12},
  pitch: ${isNavigating ? 55 : 0},
  bearing: ${isNavigating ? heading : 0},
  antialias: true
});

map.on('load', function() {

  // موقع المستخدم
  var userEl = document.createElement('div');
  userEl.style.cssText = 'width:20px;height:20px;background:#2563EB;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4)';
  new mapboxgl.Marker(userEl)
    .setLngLat([${center.longitude}, ${center.latitude}])
    .addTo(map);

  // حدود المحافظة
  var boundary = ${boundaryJSON};
  if (boundary) {
    map.addSource('gov', {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [boundary] } }
    });
    map.addLayer({ id: 'gov-fill', type: 'fill', source: 'gov', paint: { 'fill-color': '#2563EB', 'fill-opacity': 0.05 } });
    map.addLayer({ id: 'gov-line', type: 'line', source: 'gov', paint: { 'line-color': '#2563EB', 'line-width': 2.5 } });
  }

  // خط المسار
  var route = ${routeJSON};
  if (route && route.length >= 2) {
    map.addSource('route', {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates: route } }
    });
    map.addLayer({ id: 'route-shadow', type: 'line', source: 'route', paint: { 'line-color': '#000', 'line-width': 12, 'line-opacity': 0.15 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'route-main', type: 'line', source: 'route', paint: { 'line-color': '#2563EB', 'line-width': 8 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'route-inner', type: 'line', source: 'route', paint: { 'line-color': '#93C5FD', 'line-width': 3 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  }

  // علامة الوجهة
  var dest = ${destJSON};
  if (dest) {
    var destEl = document.createElement('div');
    destEl.style.cssText = 'width:20px;height:20px;background:#EF4444;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4)';
    new mapboxgl.Marker(destEl).setLngLat(dest).addTo(map);
  }
});
</script>
</body>
</html>`;

  if (Platform.OS !== "web") return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      {React.createElement("iframe", {
        srcDoc: html,
        style: { border: 0, width: "100%", height: "100%" },
        title: "Mapbox",
        allowFullScreen: true,
      })}
    </View>
  );
}

// ═══════════════════════════════════════════
// دوال المساعدة
// ═══════════════════════════════════════════
async function fetchGovernorateBoundary(
  regionName: string,
  mounted: boolean,
  setBoundary: (b: GovBoundary) => void,
  setLoading: (l: boolean) => void,
) {
  try {
    setLoading(true);
    const apiRes = await fetch(
      "https://www.geoboundaries.org/api/current/gbOpen/IRQ/ADM1/",
    );
    const apiData = await apiRes.json();
    const geoRes = await fetch(apiData.gjDownloadURL);
    const geoData = await geoRes.json();

    const feature = geoData.features.find((f: any) => {
      const name = f.properties?.shapeName ?? f.properties?.NAME_1 ?? "";
      return (
        name.toLowerCase().includes(regionName.toLowerCase()) ||
        regionName.toLowerCase().includes(name.toLowerCase())
      );
    });

    if (feature && mounted) {
      const coords = extractPolygonCoords(feature.geometry);
      if (coords.length > 0) setBoundary(coords);
    }
  } catch {
    /* مو مشكلة */
  } finally {
    if (mounted) setLoading(false);
  }
}

function extractPolygonCoords(geometry: any): GovBoundary {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    return geometry.coordinates[0].map(([lng, lat]: [number, number]) => ({
      latitude: lat,
      longitude: lng,
    }));
  }
  if (geometry.type === "MultiPolygon") {
    let largest: GovBoundary = [];
    for (const poly of geometry.coordinates) {
      const c = poly[0].map(([lng, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lng,
      }));
      if (c.length > largest.length) largest = c;
    }
    return largest;
  }
  return [];
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} كم`;
  return `${Math.round(meters)} م`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins >= 60) return `${Math.floor(mins / 60)} س ${mins % 60} د`;
  return `${mins} دقيقة`;
}

// ═══════════════════════════════════════════
// الأنماط
// ═══════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },
  mapWrap: { flex: 1, position: "relative" },

  // بطاقة التعليمات (أعلى — أثناء الملاحة)
  instructionCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1a1a2e",
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  turnIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: BRAND_BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  instructionDist: {
    color: "#93C5FD",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  instructionText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  // بطاقة الوقت (أسفل — أثناء الملاحة)
  navBottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1a1a2e",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  navInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navTime: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  navDot: {
    color: "#64748B",
    fontSize: 18,
  },
  navDist: {
    color: "#94A3B8",
    fontSize: 16,
    fontWeight: "600",
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EF4444",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  stopText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  // البطاقة العلوية (بدون ملاحة)
  overlayTop: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    gap: 10,
  },
  headerCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37,99,235,0.10)",
  },
  headerTitle: { color: "#0F172A", fontWeight: "700" },
  headerSubtitle: { color: "#64748B", marginTop: 2 },
  statusCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignSelf: "flex-end",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statusText: { color: "#0F172A" },

  // زر تجربة الملاحة
  testBtn: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  testBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  // Fallback
  fallback: {
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
});
