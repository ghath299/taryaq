import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Platform, ActivityIndicator, useColorScheme } from "react-native";
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
const SEARCH_RADIUS_M = 800;

type Coords = { latitude: number; longitude: number };

export default function OSMMapScreen() {
  const [coords, setCoords] = useState<Coords | null>(null);
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
        setCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch {
        if (mounted) setErrorMsg("تعذّر تحديد موقعك الحالي");
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? "#0F172A" : SOFT_BG }]} edges={["top"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "الصيدليات القريبة",
          headerTitleAlign: "center",
          headerBackTitle: "رجوع",
        }}
      />

      <View style={styles.mapWrap}>
        {Platform.OS === "web" ? (
          <WebMap coords={coords} isDark={isDark} />
        ) : (
          <NativeMap mapRef={mapRef} coords={coords} isDark={isDark} />
        )}

        <View pointerEvents="box-none" style={styles.overlayTop}>
          <View style={[styles.headerCard, { backgroundColor: isDark ? "#1E293B" : CARD_BG }]}>
            <View style={styles.headerIconWrap}>
              <Feather name="map-pin" size={20} color={BRAND_BLUE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="h4" style={[styles.headerTitle, { textAlign: "right" }]}>
                البحث عن الصيدليات القريبة
              </ThemedText>
              <ThemedText type="caption" style={[styles.headerSubtitle, { textAlign: "right" }]}>
                Google Maps داخل تطبيق ترياق
              </ThemedText>
            </View>
          </View>

          {!coords && !errorMsg ? (
            <View style={[styles.statusCard, { backgroundColor: isDark ? "#1E293B" : CARD_BG }]}>
              <ActivityIndicator size="small" color={BRAND_BLUE} />
              <ThemedText type="caption" style={styles.statusText}>
                جاري تحديد موقعك الحالي…
              </ThemedText>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={[styles.statusCard, { backgroundColor: isDark ? "#1E293B" : CARD_BG }]}>
              <Feather name="alert-circle" size={16} color="#DC2626" />
              <ThemedText type="caption" style={styles.statusText}>
                {errorMsg}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {coords ? (
          <View style={[styles.legendCard, { backgroundColor: isDark ? "#1E293B" : CARD_BG }]}>
            <View style={[styles.legendDot, { backgroundColor: BRAND_BLUE }]} />
            <ThemedText type="caption" style={styles.legendText}>
              نطاق البحث: {SEARCH_RADIUS_M} متر حول موقعك
            </ThemedText>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function NativeMap({
  mapRef,
  coords,
  isDark,
}: {
  mapRef: React.MutableRefObject<unknown>;
  coords: Coords | null;
  isDark: boolean;
}) {
  const Maps = require("react-native-maps");
  const MapView = Maps.default;
  const { Marker, Circle, PROVIDER_GOOGLE } = Maps;

  const region = coords
    ? {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: DEFAULT_LAT,
        longitude: DEFAULT_LNG,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <MapView
      ref={(r: unknown) => { mapRef.current = r; }}
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_GOOGLE}
      region={region}
      showsCompass={false}
      showsMyLocationButton={false}
      rotateEnabled={false}
      pitchEnabled={false}
      customMapStyle={isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
    >
      {coords ? (
        <>
          <Marker coordinate={coords} title="موقعك الحالي" pinColor={BRAND_BLUE} />
          <Circle
            center={coords}
            radius={SEARCH_RADIUS_M}
            strokeColor={BRAND_BLUE}
            strokeWidth={2}
            fillColor="rgba(37,99,235,0.12)"
          />
        </>
      ) : null}
    </MapView>
  );
}

function WebMap({ coords, isDark }: { coords: Coords | null; isDark: boolean }) {
  const center = coords ?? { latitude: DEFAULT_LAT, longitude: DEFAULT_LNG };
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? "";
  const mapStyle = isDark ? JSON.stringify(DARK_MAP_STYLE) : JSON.stringify(LIGHT_MAP_STYLE);

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
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      styles: ${mapStyle}
    });

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

    new google.maps.Circle({
      map: map,
      center: center,
      radius: ${SEARCH_RADIUS_M},
      strokeColor: "#2563EB",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: "#2563EB",
      fillOpacity: 0.12,
    });
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
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
];

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1f2937" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#374151" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1f2937" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#d1d5db" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4b5563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#111827" }] },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "on" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "building", elementType: "geometry", stylers: [{ color: "#374151" }] },
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
  legendCard: {
    position: "absolute",
    bottom: 18,
    alignSelf: "center",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: "#0F172A" },
});
