import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT = "#22D3EE";
const BRAND_BLUE = "#1F40C8";
const SOFT_BG = "#F4F7FB";
const CARD_BG = "#FFFFFF";
const DEFAULT_LAT = 33.3152;
const DEFAULT_LNG = 44.3661;
const SEARCH_RADIUS_M = 1000;

type Coords = { latitude: number; longitude: number };

type Pharmacy = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  rating: number;
  isOpen: boolean;
  distanceText: string;
  workingHours: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function offsetCoord(lat: number, lng: number, distM: number, bearingDeg: number): Coords {
  const R = 6371000;
  const b = (bearingDeg * Math.PI) / 180;
  const latR = (lat * Math.PI) / 180;
  const newLatR = Math.asin(
    Math.sin(latR) * Math.cos(distM / R) +
      Math.cos(latR) * Math.sin(distM / R) * Math.cos(b),
  );
  const newLngR =
    (lng * Math.PI) / 180 +
    Math.atan2(
      Math.sin(b) * Math.sin(distM / R) * Math.cos(latR),
      Math.cos(distM / R) - Math.sin(latR) * Math.sin(newLatR),
    );
  return {
    latitude: (newLatR * 180) / Math.PI,
    longitude: (newLngR * 180) / Math.PI,
  };
}

function buildFakePharmacies(center: Coords): Pharmacy[] {
  const data = [
    { id: "p1", name: "صيدلية الشفاء",     bearing: 30,  dist: 250, rating: 4.8, isOpen: true,  hours: "24 ساعة" },
    { id: "p2", name: "صيدلية الحياة",     bearing: 110, dist: 380, rating: 4.5, isOpen: true,  hours: "8ص – 11م" },
    { id: "p3", name: "صيدلية الأمل",      bearing: 195, dist: 520, rating: 4.2, isOpen: false, hours: "8ص – 10م" },
    { id: "p4", name: "صيدلية النور",       bearing: 270, dist: 670, rating: 4.7, isOpen: true,  hours: "8ص – 12ص" },
    { id: "p5", name: "صيدلية البركة",     bearing: 330, dist: 820, rating: 4.3, isOpen: true,  hours: "9ص – 9م"  },
  ];
  return data.map((d) => {
    const c = offsetCoord(center.latitude, center.longitude, d.dist, d.bearing);
    const km = d.dist >= 1000 ? `${(d.dist / 1000).toFixed(1)} كم` : `${d.dist} م`;
    return {
      id: d.id,
      name: d.name,
      latitude: c.latitude,
      longitude: c.longitude,
      rating: d.rating,
      isOpen: d.isOpen,
      distanceText: km,
      workingHours: d.hours,
    };
  });
}

// ─── Leaflet HTML ─────────────────────────────────────────────────────────────
function buildLeafletHtml(
  lat: number,
  lng: number,
  radius: number,
  pharmacies: Pharmacy[],
  isDark: boolean,
): string {
  const phJson = JSON.stringify(
    pharmacies.map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.latitude,
      lng: p.longitude,
      isOpen: p.isOpen,
      rating: p.rating,
    })),
  );

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{height:100%;width:100%;background:${isDark ? "#0F172A" : "#E8F4FD"}}
.ud{width:18px;height:18px;background:${BRAND_BLUE};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(31,64,200,.6)}
.pm{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid rgba(255,255,255,.9);box-shadow:0 2px 10px rgba(0,0,0,.3);font-size:17px;cursor:pointer}
.leaflet-control-zoom{border:none!important;box-shadow:0 2px 8px rgba(0,0,0,.15)!important}
.leaflet-control-zoom a{border-radius:8px!important;background:rgba(255,255,255,.95)!important;color:#333!important;font-weight:bold!important;width:30px!important;height:30px!important;line-height:30px!important;margin-bottom:2px!important}
.leaflet-popup-content-wrapper{border-radius:12px;border:none;box-shadow:0 4px 20px rgba(0,0,0,.2);background:${isDark ? "#1E293B" : "#fff"};color:${isDark ? "#F8FAFC" : "#0F172A"}}
.leaflet-popup-tip{background:${isDark ? "#1E293B" : "#fff"}}
.leaflet-popup-content{margin:10px 14px;font-family:sans-serif;font-size:13px;font-weight:600;text-align:right;direction:rtl}
</style>
</head><body><div id="map"></div><script>
var pharmacies=${phJson};

var map=L.map('map',{minZoom:12,maxZoom:19,zoomControl:true,attributionControl:false});
L.tileLayer('${tileUrl}',{maxZoom:19}).addTo(map);
map.setView([${lat},${lng}],15);

// User location dot
var udIcon=L.divIcon({className:'',html:'<div class="ud"></div>',iconSize:[18,18],iconAnchor:[9,9]});
L.marker([${lat},${lng}],{icon:udIcon,zIndexOffset:1000}).addTo(map);

// Search radius circle
L.circle([${lat},${lng}],{
  radius:${radius},
  color:'${BRAND_BLUE}',
  weight:1.5,
  fillColor:'${ACCENT}',
  fillOpacity:0.07
}).addTo(map);

// Pharmacy markers
pharmacies.forEach(function(p){
  var emoji=p.isOpen?'🟢':'🔴';
  var icon=L.divIcon({className:'',html:'<div class="pm" style="background:'+(p.isOpen?'#22C55E':'#EF4444')+'">'+emoji+'</div>',iconSize:[32,32],iconAnchor:[16,16]});
  var marker=L.marker([p.lat,p.lng],{icon:icon}).addTo(map);
  marker.bindPopup('<b>'+p.name+'</b><br/>⭐ '+p.rating+(p.isOpen?'<br/><span style="color:#22C55E">مفتوحة الآن</span>':'<br/><span style="color:#EF4444">مغلقة</span>'));
  marker.on('click',function(){
    if(window.ReactNativeWebView){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'pharmacySelect',id:p.id}));
    }
  });
});
</script></body></html>`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OSMMapScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [coords, setCoords] = useState<Coords | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);

  const center = coords ?? { latitude: DEFAULT_LAT, longitude: DEFAULT_LNG };
  const pharmacies = useMemo(() => buildFakePharmacies(center), [
    Math.round(center.latitude * 1000),
    Math.round(center.longitude * 1000),
  ]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (mounted) { setErrorMsg("لم يُسمح بالوصول إلى الموقع"); setLoading(false); }
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!mounted) return;
        setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        if (mounted) setErrorMsg("تعذّر تحديد موقعك الحالي");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleWebMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data) as { type: string; id?: string };
        if (msg.type === "pharmacySelect" && msg.id) {
          const ph = pharmacies.find((p) => p.id === msg.id) ?? null;
          setSelectedPharmacy(ph);
        }
      } catch { /* ignore */ }
    },
    [pharmacies],
  );

  const mapHtml = useMemo(
    () => buildLeafletHtml(center.latitude, center.longitude, SEARCH_RADIUS_M, pharmacies, isDark),
    [center.latitude, center.longitude, isDark],
  );

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
        {/* ─── Leaflet WebView ─── */}
        {Platform.OS === "web" ? (
          <WebMapEmbed coords={center} />
        ) : (
          <WebView
            key={`${center.latitude}-${center.longitude}-${isDark}`}
            source={{ html: mapHtml }}
            style={StyleSheet.absoluteFill}
            onMessage={handleWebMessage}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={["*"]}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
          />
        )}

        {/* Loading overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.loadingText}>
              {coords ? "جاري تحميل الخريطة…" : "جاري تحديد موقعك…"}
            </Text>
          </View>
        )}

        {/* Error banner */}
        {errorMsg && (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={16} color="#F87171" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Header info card */}
        {!selectedPharmacy && (
          <View pointerEvents="box-none" style={styles.overlayTop}>
            <View style={[styles.headerCard, { backgroundColor: isDark ? "rgba(15,23,42,0.92)" : CARD_BG }]}>
              <Feather name="map-pin" size={18} color={ACCENT} />
              <View style={{ flex: 1, marginRight: 8 }}>
                <ThemedText type="h4" style={[styles.headerTitle, { color: isDark ? "#F8FAFC" : "#0F172A" }]}>
                  الصيدليات القريبة منك
                </ThemedText>
                <ThemedText type="caption" style={styles.headerSub}>
                  اضغط على أي صيدلية لعرض تفاصيلها
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Pharmacy info card */}
        {selectedPharmacy && (
          <View style={[styles.pharmacyCard, { backgroundColor: isDark ? "#1E293B" : CARD_BG }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedPharmacy(null)}>
              <Feather name="x" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.pharmacyHeader}>
              <View style={[styles.pharmacyIcon, { backgroundColor: isDark ? "#0F172A" : "#F0F9FF" }]}>
                <Feather name="plus-square" size={28} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pharmacyName, { color: isDark ? "#F8FAFC" : "#0F172A" }]}>
                  {selectedPharmacy.name}
                </Text>
                <View style={styles.pharmacyMeta}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: selectedPharmacy.isOpen ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)" },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: selectedPharmacy.isOpen ? "#22C55E" : "#EF4444" },
                      ]}
                    />
                    <Text style={[styles.statusText, { color: selectedPharmacy.isOpen ? "#22C55E" : "#EF4444" }]}>
                      {selectedPharmacy.isOpen ? "مفتوحة" : "مغلقة"}
                    </Text>
                  </View>
                  <Text style={styles.pharmacyRating}>⭐ {selectedPharmacy.rating}</Text>
                  <Text style={[styles.pharmacyDist, { color: isDark ? "#94A3B8" : "#64748B" }]}>
                    {selectedPharmacy.distanceText}
                  </Text>
                </View>
                <View style={styles.hoursRow}>
                  <Feather name="clock" size={12} color="#94A3B8" />
                  <Text style={[styles.hoursText, { color: isDark ? "#94A3B8" : "#64748B" }]}>
                    {selectedPharmacy.workingHours}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.pharmacyBtns}>
              <TouchableOpacity style={[styles.navBtn, { backgroundColor: ACCENT }]}>
                <Feather name="navigation" size={15} color="#06111A" />
                <Text style={styles.navBtnText}>الملاحة</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.searchBtn, { borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
                <Feather name="search" size={14} color={ACCENT} />
                <Text style={[styles.searchBtnText, { color: ACCENT }]}>البحث عن دواء</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Web fallback (iframe embed) ──────────────────────────────────────────────
function WebMapEmbed({ coords }: { coords: Coords }) {
  const delta = 0.02;
  const bbox = [
    coords.longitude - delta,
    coords.latitude - delta,
    coords.longitude + delta,
    coords.latitude + delta,
  ].join(",");
  const marker = `${coords.latitude},${coords.longitude}`;
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1 },
  mapWrap:     { flex: 1, position: "relative" },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    gap: 12,
  },
  loadingText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  errorBanner: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.15)",
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: "#F87171", fontSize: 13, flex: 1, textAlign: "right" },

  overlayTop: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
  },
  headerCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: { fontSize: 14, fontWeight: "700", textAlign: "right" },
  headerSub:   { fontSize: 11, color: "#94A3B8", textAlign: "right", marginTop: 1 },

  pharmacyCard: {
    position: "absolute",
    bottom: 16,
    left: 12,
    right: 12,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    padding: 4,
  },
  pharmacyHeader: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 12 },
  pharmacyIcon:   { width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pharmacyName:   { fontSize: 15, fontWeight: "800", textAlign: "right", marginBottom: 4 },
  pharmacyMeta:   { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 4 },
  statusBadge:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusText:     { fontSize: 11, fontWeight: "700" },
  pharmacyRating: { fontSize: 12, color: "#F59E0B" },
  pharmacyDist:   { fontSize: 12 },
  hoursRow:       { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  hoursText:      { fontSize: 11 },

  pharmacyBtns: { flexDirection: "row-reverse", gap: 10, marginTop: 14 },
  navBtn:       { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 14 },
  navBtnText:   { fontSize: 14, fontWeight: "700", color: "#06111A" },
  searchBtn:    { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 14, borderWidth: 1 },
  searchBtnText:{ fontSize: 14, fontWeight: "700" },
});
