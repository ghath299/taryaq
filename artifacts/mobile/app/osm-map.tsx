import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";

const BRAND_BLUE = "#2563EB";
const SOFT_BG = "#F4F7FB";
const CARD_BG = "#FFFFFF";

const DEFAULT_LAT = 33.3152;
const DEFAULT_LNG = 44.3661;

type Coords = { latitude: number; longitude: number };
type GovBoundary = { latitude: number; longitude: number }[];

// أسماء المحافظات العراقية (عربي ← إنجليزي)
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

export default function OSMMapScreen() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [governorate, setGovernorate] = useState<string | null>(null);
  const [govBoundary, setGovBoundary] = useState<GovBoundary | null>(null);
  const [loadingBoundary, setLoadingBoundary] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mapRef = useRef<unknown>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

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
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mounted) return;

        const userCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setCoords(userCoords);

        // تحديد المحافظة
        const geo = await Location.reverseGeocodeAsync(userCoords);
        if (geo && geo.length > 0) {
          const regionEn = geo[0].region ?? geo[0].subregion ?? null;
          if (regionEn && mounted) {
            const regionAr = GOVERNORATE_MAP[regionEn] ?? regionEn;
            setGovernorate(regionAr);
            // جلب حدود المحافظة
            fetchGovernorateBoundary(
              regionEn,
              mounted,
              setGovBoundary,
              setLoadingBoundary,
            );
          }
        }
      } catch {
        if (mounted) setErrorMsg("تعذّر تحديد موقعك الحالي");
      }
    })();
    return () => {
      mounted = false;
    };
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
          headerShown: true,
          headerTitle: governorate
            ? `صيدليات وأطباء ${governorate}`
            : "الصيدليات والأطباء",
          headerTitleAlign: "center",
          headerBackTitle: "رجوع",
        }}
      />

      <View style={styles.mapWrap}>
        {Platform.OS === "web" ? (
          <WebMap coords={coords} isDark={isDark} govBoundary={govBoundary} />
        ) : (
          <NativeMap
            mapRef={mapRef}
            coords={coords}
            isDark={isDark}
            govBoundary={govBoundary}
          />
        )}

        <View pointerEvents="box-none" style={styles.overlayTop}>
          <View
            style={[
              styles.headerCard,
              { backgroundColor: isDark ? "#1E293B" : CARD_BG },
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
                Google Maps داخل تطبيق ترياق
              </ThemedText>
            </View>
          </View>

          {(!coords || loadingBoundary) && !errorMsg ? (
            <View
              style={[
                styles.statusCard,
                { backgroundColor: isDark ? "#1E293B" : CARD_BG },
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
                { backgroundColor: isDark ? "#1E293B" : CARD_BG },
              ]}
            >
              <Feather name="alert-circle" size={16} color="#DC2626" />
              <ThemedText type="caption" style={styles.statusText}>
                {errorMsg}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

// جلب حدود المحافظة من geoBoundaries API
async function fetchGovernorateBoundary(
  regionName: string,
  mounted: boolean,
  setBoundary: (b: GovBoundary) => void,
  setLoading: (l: boolean) => void,
) {
  try {
    setLoading(true);
    // جلب معلومات الملف من API
    const apiRes = await fetch(
      "https://www.geoboundaries.org/api/current/gbOpen/IRQ/ADM1/",
    );
    const apiData = await apiRes.json();
    const geojsonUrl = apiData.gjDownloadURL;

    // جلب ملف GeoJSON
    const geoRes = await fetch(geojsonUrl);
    const geoData = await geoRes.json();

    // البحث عن المحافظة المناسبة
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
    // ما ظهر حد المحافظة — مو مشكلة
  } finally {
    if (mounted) setLoading(false);
  }
}

// استخراج إحداثيات الـ Polygon من GeoJSON
function extractPolygonCoords(geometry: any): GovBoundary {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    return geometry.coordinates[0].map(([lng, lat]: [number, number]) => ({
      latitude: lat,
      longitude: lng,
    }));
  }
  if (geometry.type === "MultiPolygon") {
    // أكبر polygon
    let largest: GovBoundary = [];
    for (const poly of geometry.coordinates) {
      const coords = poly[0].map(([lng, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lng,
      }));
      if (coords.length > largest.length) largest = coords;
    }
    return largest;
  }
  return [];
}

function NativeMap({
  mapRef,
  coords,
  isDark,
  govBoundary,
}: {
  mapRef: React.MutableRefObject<unknown>;
  coords: Coords | null;
  isDark: boolean;
  govBoundary: GovBoundary | null;
}) {
  const Maps = require("react-native-maps");
  const MapView = Maps.default;
  const { Marker, Polygon, PROVIDER_GOOGLE } = Maps;

  const region = coords
    ? {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      }
    : {
        latitude: DEFAULT_LAT,
        longitude: DEFAULT_LNG,
        latitudeDelta: 1.0,
        longitudeDelta: 1.0,
      };

  return (
    <MapView
      key={isDark ? "dark" : "light"}
      ref={(r: unknown) => {
        mapRef.current = r;
      }}
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_GOOGLE}
      region={region}
      showsCompass={false}
      showsMyLocationButton={false}
      rotateEnabled={false}
      pitchEnabled={false}
      scrollEnabled={true}
      zoomEnabled={true}
      zoomTapEnabled={true}
      customMapStyle={isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
    >
      {/* حدود المحافظة */}
      {govBoundary && govBoundary.length > 0 ? (
        <Polygon
          coordinates={govBoundary}
          strokeColor={BRAND_BLUE}
          strokeWidth={2.5}
          fillColor={isDark ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.06)"}
        />
      ) : null}

      {/* موقع المستخدم */}
      {coords ? (
        <Marker
          coordinate={coords}
          title="موقعك الحالي"
          pinColor={BRAND_BLUE}
        />
      ) : null}
    </MapView>
  );
}

function WebMap({
  coords,
  isDark,
  govBoundary,
}: {
  coords: Coords | null;
  isDark: boolean;
  govBoundary: GovBoundary | null;
}) {
  const center = coords ?? { latitude: DEFAULT_LAT, longitude: DEFAULT_LNG };
  const apiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    process.env.GOOGLE_MAPS_API_KEY ??
    "";
  const mapStyle = isDark
    ? JSON.stringify(DARK_MAP_STYLE)
    : JSON.stringify(LIGHT_MAP_STYLE);
  const boundaryCoords = govBoundary
    ? JSON.stringify(
        govBoundary.map((c) => ({ lat: c.latitude, lng: c.longitude })),
      )
    : "null";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  function initMap() {
    var center = { lat: ${center.latitude}, lng: ${center.longitude} };
    var map = new google.maps.Map(document.getElementById("map"), {
      center: center,
      zoom: 10,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
      styles: ${mapStyle}
    });

    // موقع المستخدم
    new google.maps.Marker({
      position: center,
      map: map,
      title: "موقعك الحالي",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#2563EB",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      }
    });

    // حدود المحافظة
    var boundaryCoords = ${boundaryCoords};
    if (boundaryCoords && boundaryCoords.length > 0) {
      new google.maps.Polygon({
        paths: boundaryCoords,
        map: map,
        strokeColor: "#2563EB",
        strokeOpacity: 0.9,
        strokeWeight: 2.5,
        fillColor: "#2563EB",
        fillOpacity: 0.06,
      });
    }
  }
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap&language=ar&region=IQ" async defer></script>
</body>
</html>`;

  if (Platform.OS !== "web") return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      {React.createElement("iframe", {
        srcDoc: html,
        style: { border: 0, width: "100%", height: "100%" },
        title: "Google Maps",
        allowFullScreen: true,
      })}
    </View>
  );
}

const LIGHT_MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "on" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "road",
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "building",
    elementType: "geometry",
    stylers: [{ visibility: "on", color: "#e8e0d8" }],
  },
  {
    featureType: "building",
    elementType: "geometry.stroke",
    stylers: [{ color: "#c9bfb5" }],
  },
  {
    featureType: "water",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f5f5f0" }],
  },
];

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1f2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1f2e" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2d3748", visibility: "on" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1a1f2e" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e0" }],
  },
  {
    featureType: "road",
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#4a5568" }],
  },
  {
    featureType: "building",
    elementType: "geometry",
    stylers: [{ color: "#2d3748", visibility: "on" }],
  },
  {
    featureType: "building",
    elementType: "geometry.fill",
    stylers: [{ color: "#252d3d" }],
  },
  {
    featureType: "building",
    elementType: "geometry.stroke",
    stylers: [{ color: "#374151" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "water",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "on" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#111827" }],
  },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapWrap: { flex: 1, position: "relative" },
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
});
