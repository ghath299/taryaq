import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";

const BRAND_BLUE = "#2563EB";
const BRAND_TEAL = "#14B8A6";
const SOFT_BG = "#F4F7FB";
const CARD_BG = "#FFFFFF";

const DEFAULT_REGION = {
  latitude: 33.3152,
  longitude: 44.3661,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const SEARCH_RADIUS_M = 800;

type Coords = { latitude: number; longitude: number };

export default function OSMMapScreen() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mapRef = useRef<unknown>(null);

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
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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
          <WebMap coords={coords} />
        ) : (
          <NativeMap mapRef={mapRef} coords={coords} />
        )}

        <View pointerEvents="box-none" style={styles.overlayTop}>
          <View style={styles.headerCard}>
            <View style={styles.headerIconWrap}>
              <Feather name="map-pin" size={20} color={BRAND_BLUE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText
                type="h4"
                style={[styles.headerTitle, { textAlign: "right" }]}
              >
                البحث عن الصيدليات القريبة
              </ThemedText>
              <ThemedText
                type="caption"
                style={[styles.headerSubtitle, { textAlign: "right" }]}
              >
                OpenStreetMap داخل تطبيق ترياق
              </ThemedText>
            </View>
          </View>

          {!coords && !errorMsg ? (
            <View style={styles.statusCard}>
              <ActivityIndicator size="small" color={BRAND_BLUE} />
              <ThemedText type="caption" style={styles.statusText}>
                جاري تحديد موقعك الحالي…
              </ThemedText>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={styles.statusCard}>
              <Feather name="alert-circle" size={16} color="#DC2626" />
              <ThemedText type="caption" style={styles.statusText}>
                {errorMsg}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {coords ? (
          <View style={styles.legendCard}>
            <View
              style={[styles.legendDot, { backgroundColor: BRAND_BLUE }]}
            />
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
}: {
  mapRef: React.MutableRefObject<unknown>;
  coords: Coords | null;
}) {
  const Maps = require("react-native-maps");
  const MapView = Maps.default;
  const { UrlTile, Marker, Circle, MAP_TYPES, PROVIDER_DEFAULT } = Maps;

  const region = coords
    ? {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : DEFAULT_REGION;

  return (
    <MapView
      ref={(r: unknown) => {
        mapRef.current = r;
      }}
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_DEFAULT}
      mapType={MAP_TYPES.NONE}
      region={region}
      showsCompass={false}
      showsMyLocationButton={false}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      <UrlTile
        urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maximumZ={19}
        flipY={false}
        tileSize={256}
      />
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

function WebMap({ coords }: { coords: Coords | null }) {
  const center = coords ?? { latitude: 33.3152, longitude: 44.3661 };
  const delta = 0.02;
  const bbox = [
    center.longitude - delta,
    center.latitude - delta,
    center.longitude + delta,
    center.latitude + delta,
  ].join(",");
  const marker = `${center.latitude},${center.longitude}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;

  if (Platform.OS !== "web") return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      {React.createElement("iframe", {
        src,
        style: { border: 0, width: "100%", height: "100%" },
        title: "OpenStreetMap",
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SOFT_BG },
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
    backgroundColor: CARD_BG,
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
    backgroundColor: CARD_BG,
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
    backgroundColor: CARD_BG,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: { color: "#0F172A" },
});
