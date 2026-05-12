import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";
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
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { addAlpha } from "@/constants/colors";

// ── Karbala Governorate GeoJSON boundary ──────────────────────────────────────
// Source: OpenStreetMap / geoBoundaries (محافظة كربلاء المقدسة)
// Coordinates: GeoJSON [longitude, latitude] format
const KARBALA_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "كربلاء", name_en: "Karbala Governorate" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [43.0044, 33.5093],
            [43.2000, 33.5100],
            [43.5000, 33.5050],
            [43.8000, 33.4900],
            [44.0500, 33.4400],
            [44.2500, 33.3200],
            [44.4000, 33.1800],
            [44.5200, 33.0500],
            [44.6031, 32.9000],
            [44.6031, 32.6500],
            [44.5800, 32.4000],
            [44.5200, 32.1500],
            [44.4000, 32.0000],
            [44.2200, 31.8800],
            [44.0000, 31.8000],
            [43.7500, 31.7988],
            [43.5000, 31.8100],
            [43.2500, 31.8600],
            [43.1000, 31.9500],
            [43.0500, 32.0800],
            [43.0044, 32.2500],
            [43.0044, 32.6000],
            [43.0044, 33.0000],
            [43.0044, 33.2500],
            [43.0044, 33.5093],
          ],
        ],
      },
    },
  ],
} as const;

// Karbala city centre — fallback when location permission is denied
const KARBALA = { latitude: 32.6163, longitude: 44.0246 };

// Bearings (degrees from north) for each pharmacy relative to user
const PHARMACY_BEARINGS: Record<string, number> = {
  p1: 10,   // N-NE  (near shrine area)
  p2: 75,   // ENE
  p3: 150,  // SE
  p4: 230,  // SW
  p5: 310,  // NW
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
    latitude:  (newLatR * 180) / Math.PI,
    longitude: (newLngR * 180) / Math.PI,
  };
}

// Ray-casting point-in-polygon (runs in JS, not in WebView)
function pointInPolygon(lat: number, lng: number, ringCoords: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = ringCoords.length - 1; i < ringCoords.length; j = i++) {
    const xi = ringCoords[i][0]; const yi = ringCoords[i][1]; // [lng, lat]
    const xj = ringCoords[j][0]; const yj = ringCoords[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

const KARBALA_RING = KARBALA_GEOJSON.features[0].geometry.coordinates[0];

export type PharmacyStatus = "waiting" | "available" | "unavailable" | "timeout";

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

// Mock pharmacies — Karbala neighbourhoods
const MOCK_PHARMACIES: MapPharmacy[] = [
  { id: "p1", name: "صيدلية الحسينية",    address: "شارع الإمام الحسين، كربلاء",           distanceM: 280,  rating: 4.8, isAvailable: true,  status: "waiting" },
  { id: "p2", name: "صيدلية العباسية",    address: "مقابل مرقد أبو الفضل العباس",          distanceM: 420,  rating: 4.6, isAvailable: true,  status: "waiting" },
  { id: "p3", name: "صيدلية الشفاء",      address: "شارع طريق النجف، كربلاء",              distanceM: 550,  rating: 4.3, isAvailable: false, status: "waiting" },
  { id: "p4", name: "صيدلية النهضة",      address: "حي النهضة، كربلاء المقدسة",            distanceM: 700,  rating: 4.7, isAvailable: true,  status: "waiting" },
  { id: "p5", name: "صيدلية باب بغداد",   address: "شارع باب بغداد، كربلاء",               distanceM: 860,  rating: 4.4, isAvailable: true,  status: "waiting" },
];

const FIRST_AVAILABLE_ID = "p1";

// ── Leaflet HTML builder ───────────────────────────────────────────────────────

function buildLeafletHtml(
  lat: number,
  lng: number,
  radius: number,
  pharmacies: Array<{ id: string; name: string; lat: number; lng: number }>,
): string {
  const phJson    = JSON.stringify(pharmacies);
  const geoJson   = JSON.stringify(KARBALA_GEOJSON);
  const ringCoords = JSON.stringify(KARBALA_RING);

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{height:100%;width:100%;background:#e8f4fd}
.ud{width:16px;height:16px;background:#1F40C8;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(31,64,200,.5)}
.pm{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid rgba(255,255,255,.9);box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:16px}
.leaflet-control-zoom{border:none!important;box-shadow:0 2px 8px rgba(0,0,0,.15)!important}
.leaflet-control-zoom a{border-radius:8px!important;background:rgba(255,255,255,.95)!important;color:#333!important;font-weight:bold!important;width:30px!important;height:30px!important;line-height:30px!important;margin-bottom:2px!important}
.leaflet-tooltip{background:rgba(255,255,255,.95);border:none;border-radius:8px;font-size:12px;font-weight:bold;color:#1F40C8;box-shadow:0 2px 8px rgba(0,0,0,.2);padding:4px 8px}
</style>
</head><body><div id="map"></div><script>
var KARBALA_GEOJSON=${geoJson};
var RING=${ringCoords};
var COLORS={waiting:'#1F40C8',available:'#22C55E',unavailable:'#EF4444',timeout:'#9CA3AF'};

// Ray-casting point-in-polygon: RING coords are [lng,lat]
function pip(lat,lng){
  var inside=false;
  for(var i=0,j=RING.length-1;i<RING.length;j=i++){
    var xi=RING[i][0],yi=RING[i][1];
    var xj=RING[j][0],yj=RING[j][1];
    if((yi>lat)!==(yj>lat)&&lng<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}

// Map with Karbala bounds
var map=L.map('map',{
  minZoom:10,
  maxZoom:18,
  zoomControl:true,
  attributionControl:false
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,minZoom:8}).addTo(map);

// Karbala governorate boundary layer
var boundaryLayer=L.geoJSON(KARBALA_GEOJSON,{
  style:{
    color:'#1F40C8',
    weight:2.5,
    fillOpacity:0.04,
    fillColor:'#5EDFFF',
    dashArray:'8 5'
  }
}).addTo(map);

// Lock map inside Karbala (with slight padding so boundary is visible)
var kbBounds=boundaryLayer.getBounds();
map.setMaxBounds(kbBounds.pad(0.05));
map.setView([${lat},${lng}],14);

// User position marker
L.marker([${lat},${lng}],{
  icon:L.divIcon({className:'',html:'<div class="ud"></div>',iconSize:[16,16],iconAnchor:[8,8]}),
  zIndexOffset:1000
}).addTo(map);

// Search radius circle
L.circle([${lat},${lng}],{
  radius:${radius},
  color:'#5EDFFF',
  fillColor:'#5EDFFF',
  fillOpacity:.07,
  weight:2,
  dashArray:'6 5'
}).addTo(map);

// Pharmacy markers — only those inside Karbala polygon
var markers={};
function mkIcon(s){
  var c=COLORS[s]||COLORS.waiting;
  return L.divIcon({className:'',html:'<div class="pm" style="background:'+c+'">+</div>',iconSize:[30,30],iconAnchor:[15,15]});
}
${phJson}.forEach(function(p){
  if(!pip(p.lat,p.lng))return;
  markers[p.id]=L.marker([p.lat,p.lng],{icon:mkIcon('waiting')})
    .addTo(map)
    .bindTooltip(p.name,{permanent:false,direction:'top',offset:[0,-18]});
});

window.updateStatus=function(id,s){if(markers[id])markers[id].setIcon(mkIcon(s));};
window.drawRoute=function(coords){
  if(!coords||coords.length<2)return;
  var pts=coords.map(function(c){return[c.latitude,c.longitude];});
  L.polyline(pts,{color:'#1F40C8',weight:4,opacity:.85}).addTo(map);
  try{map.fitBounds(L.polyline(pts).getBounds(),{padding:[30,30],maxZoom:16});}catch(e){}
};
</script></body></html>`;
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  drugName:        string;
  searchRadius:    number;
  isSearching:     boolean;
  onPharmacyFound: (pharmacy: FoundPharmacy) => void;
  showList?:       boolean;
  userLocation?:   { latitude: number; longitude: number } | null;
  routeCoords?:    { latitude: number; longitude: number }[] | null;
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
  const [foundId,    setFoundId]    = useState<string | null>(null);
  const [mapReady,   setMapReady]   = useState(false);
  const webViewRef = useRef<WebView>(null);
  const timersRef  = useRef<ReturnType<typeof setTimeout>[]>([]);

  const radarScale   = useSharedValue(0.4);
  const radarOpacity = useSharedValue(0);
  const foundPulse   = useSharedValue(1);

  const cardBg       = isDark ? theme.card : "#FFFFFF";
  const subtleBorder = isDark ? "#21262D" : "#E5EEF5";

  // Use Karbala centre as default — this app is for Karbala
  const centre = userLocation ?? KARBALA;

  // Compute real lat/lng for each pharmacy from user's position
  // Only include pharmacies whose computed coords fall inside Karbala boundary
  const pharmacyCoords = useMemo(
    () =>
      MOCK_PHARMACIES.reduce<Record<string, { latitude: number; longitude: number }>>(
        (acc, p) => {
          const coord = offsetCoord(
            centre.latitude,
            centre.longitude,
            p.distanceM,
            PHARMACY_BEARINGS[p.id] ?? 0,
          );
          // Only include if inside Karbala governorate
          if (pointInPolygon(coord.latitude, coord.longitude, KARBALA_RING)) {
            acc[p.id] = coord;
          }
          return acc;
        },
        {},
      ),
    [centre.latitude, centre.longitude],
  );

  // Build Leaflet HTML with real coordinates baked in
  const mapHtml = useMemo(() => {
    const phData = MOCK_PHARMACIES
      .filter((p) => pharmacyCoords[p.id]) // only inside Karbala
      .map((p) => {
        const c = pharmacyCoords[p.id]!;
        return { id: p.id, name: p.name, lat: c.latitude, lng: c.longitude };
      });
    return buildLeafletHtml(centre.latitude, centre.longitude, searchRadius, phData);
  }, [centre.latitude, centre.longitude, pharmacyCoords, searchRadius]);

  // Rebuild map if user moves >~100 m or radius changes
  const mapKey = `map-${Math.round(centre.latitude * 1000)}-${Math.round(centre.longitude * 1000)}-${searchRadius}`;

  // Draw route when it arrives
  useEffect(() => {
    if (!routeCoords || !mapReady) return;
    webViewRef.current?.injectJavaScript(`window.drawRoute(${JSON.stringify(routeCoords)}); true;`);
  }, [routeCoords, mapReady]);

  const injectStatus = useCallback((id: string, status: string) => {
    webViewRef.current?.injectJavaScript(`window.updateStatus('${id}','${status}'); true;`);
  }, []);

  const stopRadar = useCallback(() => {
    cancelAnimation(radarScale);
    cancelAnimation(radarOpacity);
    radarOpacity.value = withTiming(0, { duration: 300 });
  }, [radarScale, radarOpacity]);

  const handleFound = useCallback(
    (id: string) => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setFoundId(id);
      setPharmacies((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "available" as const } : p)),
      );
      injectStatus(id, "available");
      stopRadar();
      foundPulse.value = withRepeat(
        withSequence(
          withTiming(1.7, { duration: 800, easing: Easing.out(Easing.ease) }),
          withTiming(1,   { duration: 800, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      );
      const found = MOCK_PHARMACIES.find((p) => p.id === id);
      if (found) {
        const coords =
          pharmacyCoords[id] ??
          offsetCoord(centre.latitude, centre.longitude, found.distanceM, PHARMACY_BEARINGS[id] ?? 0);
        onPharmacyFound({
          ...found,
          status:    "available",
          latitude:  coords.latitude,
          longitude: coords.longitude,
        });
      }
    },
    [pharmacyCoords, centre, injectStatus, stopRadar, onPharmacyFound, foundPulse],
  );

  // Search simulation
  useEffect(() => {
    if (!isSearching) {
      stopRadar();
      return;
    }

    setPharmacies(MOCK_PHARMACIES);
    setFoundId(null);

    radarScale.value = withRepeat(
      withTiming(1.1, { duration: 2200, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    radarOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 0 }),
        withTiming(0,   { duration: 2200, easing: Easing.out(Easing.ease) }),
      ),
      -1,
      false,
    );

    const update = (id: string, status: PharmacyStatus) => {
      setPharmacies((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status } : p)),
      );
      injectStatus(id, status);
    };

    const t1 = setTimeout(() => update("p2", "unavailable"), 1200);
    const t2 = setTimeout(() => update("p3", "unavailable"), 2000);
    const t3 = setTimeout(() => update("p5", "timeout"),     2800);
    const t4 = setTimeout(() => handleFound(FIRST_AVAILABLE_ID), 3500);

    timersRef.current = [t1, t2, t3, t4];
    return () => {
      timersRef.current.forEach(clearTimeout);
      stopRadar();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearching]);

  const radarStyle      = useAnimatedStyle(() => ({ transform: [{ scale: radarScale.value }], opacity: radarOpacity.value }));
  const foundPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: foundPulse.value }], opacity: 0.35 }));

  const visiblePharmacies = pharmacies.filter((p) => !!pharmacyCoords[p.id]);
  const checkedCount = visiblePharmacies.filter((p) => p.status !== "waiting").length;
  const radiusLabel  = searchRadius >= 1000
    ? `${(searchRadius / 1000).toFixed(searchRadius % 1000 === 0 ? 0 : 1)} كم`
    : `${searchRadius} متر`;

  const badgeText = isSearching
    ? foundId ? "✓ وجدنا صيدلية!" : `جارٍ البحث... (${checkedCount}/${visiblePharmacies.length})`
    : `نطاق ${radiusLabel} · كربلاء`;

  const dotColor = (p: MapPharmacy) =>
    p.status === "available"    ? theme.success
    : p.status === "unavailable" ? theme.error
    : p.status === "timeout"     ? "#888"
    : theme.primaryDark;

  const statusLabel = (p: MapPharmacy) =>
    p.status === "available"    ? "متاح ✓"
    : p.status === "unavailable" ? "غير متاح"
    : p.status === "timeout"     ? "لم يرد"
    : "في الانتظار...";

  return (
    <View>
      <View style={[styles.mapWrap, { borderColor: subtleBorder }]}>

        {Platform.OS !== "web" ? (
          /* Native: real OpenStreetMap via WebView + Leaflet */
          <>
            <WebView
              ref={webViewRef}
              key={mapKey}
              source={{ html: mapHtml }}
              style={StyleSheet.absoluteFillObject}
              onLoad={() => setMapReady(true)}
              originWhitelist={["*"]}
              scrollEnabled={false}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mixedContentMode="always"
            />
            {/* Radar overlay — pointer-events none so map stays interactive */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.radarCenter]}>
              <View style={[styles.staticRingOuter, { borderColor: addAlpha(theme.primary, 0.18) }]} />
              <View style={[styles.staticRingInner, { borderColor: addAlpha(theme.primary, 0.28) }]} />
              <Animated.View
                style={[styles.radarPulse, { borderColor: theme.primary, backgroundColor: addAlpha(theme.primary, 0.06) }, radarStyle]}
              />
            </View>
          </>
        ) : (
          /* Web fallback */
          <>
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? "#1A2434" : "#E8F4FE" }]} />
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.radarCenter]}>
              <View style={[styles.staticRingOuter, { borderColor: addAlpha(theme.primary, 0.18) }]} />
              <View style={[styles.staticRingInner, { borderColor: addAlpha(theme.primary, 0.28) }]} />
              <Animated.View
                style={[styles.radarPulse, { borderColor: theme.primary, backgroundColor: addAlpha(theme.primary, 0.1) }, radarStyle]}
              />
              <View style={styles.userDotWrap}>
                <View style={[styles.userDotInner, { backgroundColor: theme.primaryDark }]} />
              </View>
            </View>
            {visiblePharmacies.map((p, i) => {
              const isFound = p.id === foundId;
              const color   = dotColor(p);
              const xPct    = 0.15 + (i / visiblePharmacies.length) * 0.70;
              const yPct    = 0.2  + ((i * 0.37) % 0.60);
              return (
                <View
                  key={p.id}
                  style={[styles.webPinWrap, { left: `${xPct * 100}%` as unknown as number, top: `${yPct * 100}%` as unknown as number }]}
                  pointerEvents="none"
                >
                  {isFound && (
                    <Animated.View style={[styles.pinPulse, { backgroundColor: theme.success }, foundPulseStyle]} />
                  )}
                  <View style={[styles.pin, { backgroundColor: color }]}>
                    <MaterialCommunityIcons name="hospital-box" size={13} color="#fff" />
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Status badge */}
        <View style={[styles.badge, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
          <ThemedText type="caption" style={{ color: theme.primaryDark, fontWeight: "800" }}>
            {badgeText}
          </ThemedText>
        </View>
      </View>

      {/* Pharmacy list — only Karbala pharmacies */}
      {showList && (
        <View style={{ marginTop: 8 }}>
          {visiblePharmacies.map((p) => {
            const isFound = p.id === foundId;
            const color   = dotColor(p);
            return (
              <View
                key={p.id}
                style={[
                  styles.pharmacyRow,
                  {
                    backgroundColor: cardBg,
                    borderColor:     isFound ? theme.success : subtleBorder,
                    borderWidth:     isFound ? 1.5 : 1,
                  },
                ]}
              >
                <View style={[styles.pharmacyIcon, { backgroundColor: addAlpha(color, 0.15) }]}>
                  <MaterialCommunityIcons name="hospital-box" size={18} color={color} />
                </View>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <ThemedText type="small"   style={{ color: theme.text,          fontWeight: "800", textAlign: "right" }}>{p.name}</ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary,                    textAlign: "right" }}>
                    {(p.distanceM / 1000).toFixed(2)} كم
                  </ThemedText>
                </View>
                <View style={[styles.statusTag, { backgroundColor: addAlpha(color, 0.12) }]}>
                  <ThemedText type="caption" style={{ color, fontWeight: "700" }}>{statusLabel(p)}</ThemedText>
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
  mapWrap: { height: 280, borderRadius: 16, borderWidth: 1, overflow: "hidden", position: "relative", backgroundColor: "#E8F4FE" },

  radarCenter:     { alignItems: "center", justifyContent: "center" },
  staticRingOuter: { position: "absolute", width: 200, height: 200, borderRadius: 100, borderWidth: 1, transform: [{ translateX: -100 }, { translateY: -100 }] },
  staticRingInner: { position: "absolute", width: 110, height: 110, borderRadius: 55,  borderWidth: 1, transform: [{ translateX: -55  }, { translateY: -55  }] },
  radarPulse:      { position: "absolute", width: 220, height: 220, borderRadius: 110, borderWidth: 2, transform: [{ translateX: -110 }, { translateY: -110 }] },

  userDotWrap:  { position: "absolute", width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", transform: [{ translateX: -10 }, { translateY: -10 }] },
  userDotInner: { width: 11, height: 11, borderRadius: 6 },

  webPinWrap: { position: "absolute", width: 0, height: 0, alignItems: "center", justifyContent: "center" },
  pinPulse:   { position: "absolute", width: 26, height: 26, borderRadius: 13, transform: [{ translateX: -13 }, { translateY: -13 }] },
  pin:        { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },

  badge: { position: "absolute", top: 10, alignSelf: "center", left: "8%", right: "8%", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, alignItems: "center" },

  pharmacyRow:  { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, marginBottom: 8 },
  pharmacyIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statusTag:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
});
