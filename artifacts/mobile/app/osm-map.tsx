                             import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
                             const ACCENT = "#22D3EE";
                             const SOFT_BG = "#F4F7FB";
                             const CARD_BG = "#FFFFFF";
                             const DARK_CARD = "#111827";
                             const DEFAULT_LAT = 33.3152;
                             const DEFAULT_LNG = 44.3661;

                             type Coords = { latitude: number; longitude: number };
                             type GovBoundary = { latitude: number; longitude: number }[];
                             type Pharmacy = {
                               id: string;
                               name: string;
                               latitude: number;
                               longitude: number;
                               rating: number;
                               isOpen: boolean;
                               distanceText: string;
                               photo: string;
                               workingHours: string;
                             };

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
                               const [heading, setHeading] = useState<number>(0);
                               const [governorate, setGovernorate] = useState<string | null>(null);
                               const [govBoundary, setGovBoundary] = useState<GovBoundary | null>(null);
                               const [loadingBoundary, setLoadingBoundary] = useState(false);
                               const [errorMsg, setErrorMsg] = useState<string | null>(null);

                               const [isNavigating, setIsNavigating] = useState(false);
                               const [destination, setDestination] = useState<Coords | null>(null);
                               const [routeCoords, setRouteCoords] = useState<Coords[]>([]);
                               const [navInstruction, setNavInstruction] = useState<string>("");
                               const [navDistance, setNavDistance] = useState<string>("");
                               const [navTotalDist, setNavTotalDist] = useState<string>("");
                               const [navTotalTime, setNavTotalTime] = useState<string>("");
                               const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);

                               const [navManeuverType, setNavManeuverType] = useState<string>("straight");
                               const [isCameraFollowing, setIsCameraFollowing] = useState(true);
                               const locationSub = useRef<any>(null);
                               const colorScheme = useColorScheme();
                               const isDark = colorScheme === "dark";

                               const pharmacies = useMemo(
                                 () => buildFakePharmacies(coords ?? { latitude: DEFAULT_LAT, longitude: DEFAULT_LNG }),
                                 [coords ? roundCoord(coords.latitude) : DEFAULT_LAT, coords ? roundCoord(coords.longitude) : DEFAULT_LNG],
                               );

                               useEffect(() => {
                                 let mounted = true;
                                 (async () => {
                                   try {
                                     const { status } = await Location.requestForegroundPermissionsAsync();
                                     if (status !== "granted") {
                                       if (mounted) setErrorMsg("لم يُسمح بالوصول إلى الموقع");
                                       return;
                                     }

                                     const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                                     if (!mounted) return;

                                     const userCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                                     setCoords(userCoords);
                                     if (loc.coords.heading) setHeading(loc.coords.heading);

                                     const geo = await Location.reverseGeocodeAsync(userCoords);
                                     if (geo?.[0]) {
                                       const regionEn = geo[0].region ?? geo[0].subregion ?? null;
                                       if (regionEn && mounted) {
                                         setGovernorate(GOVERNORATE_MAP[regionEn] ?? regionEn);
                                         fetchGovernorateBoundary(regionEn, mounted, setGovBoundary, setLoadingBoundary);
                                       }
                                     }

                                     locationSub.current = await Location.watchPositionAsync(
                                       {
                                         accuracy: Location.Accuracy.Balanced,
                                         timeInterval: 2500,
                                         distanceInterval: 8,
                                       },
                                       (live) => {
                                         if (!mounted) return;
                                         setCoords({ latitude: live.coords.latitude, longitude: live.coords.longitude });
                                         if (live.coords.heading !== null) setHeading(live.coords.heading ?? 0);
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

                               const fetchRoute = useCallback(async (dest: Coords, origin: Coords) => {
                                 try {
                                   if (!MAPBOX_TOKEN) {
                                     setErrorMsg("أضف EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN حتى يعمل حساب المسار");
                                     return;
                                   }
                                   const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?steps=true&geometries=geojson&language=ar&overview=full&access_token=${MAPBOX_TOKEN}`;
                                   const res = await fetch(url);
                                   const data = await res.json();
                                   if (!data.routes?.[0]) return;

                                   const route = data.routes[0];
                                   const pts: Coords[] = route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng }));
                                   setRouteCoords(pts);

                                   const firstStep = route.legs?.[0]?.steps?.[0];
                                   if (firstStep) {
                                     setNavInstruction(firstStep.maneuver?.instruction ?? "استمر على المسار");
                                     setNavDistance(formatDistance(firstStep.distance));
                                     const mType = firstStep.maneuver?.type ?? "straight";
                                     const mMod = firstStep.maneuver?.modifier ?? "";
                                     setNavManeuverType(`${mType}:${mMod}`);
                                   }
                                   setNavTotalDist(formatDistance(route.distance));
                                   setNavTotalTime(formatDuration(route.duration));
                                 } catch (e) {
                                   console.error("Route error:", e);
                                   setErrorMsg("تعذّر حساب المسار");
                                 }
                               }, []);

                               const startNavigation = useCallback(
                                 (dest: Coords) => {
                                   if (!coords) return;
                                   setDestination(dest);
                                   setIsNavigating(true);
                                   setSelectedPharmacy(null);
                                   fetchRoute(dest, coords);
                                 },
                                 [coords, fetchRoute],
                               );

                               const stopNavigation = useCallback(() => {
                                 setIsNavigating(false);
                                 setDestination(null);
                                 setRouteCoords([]);
                                 setNavInstruction("");
                                 setNavDistance("");
                                 setNavTotalDist("");
                                 setNavTotalTime("");
                                 setNavManeuverType("straight");
                                 setIsCameraFollowing(true);
                               }, []);

                               const handleSelectPharmacy = useCallback(
                                 (id: string) => {
                                   const pharmacy = pharmacies.find((p) => p.id === id) ?? null;
                                   setSelectedPharmacy(pharmacy);
                                 },
                                 [pharmacies],
                               );

                               return (
                                 <SafeAreaView style={[styles.container, { backgroundColor: isDark ? "#0F172A" : SOFT_BG }]} edges={["top"]}>
                                   <Stack.Screen
                                     options={{
                                       headerShown: !isNavigating,
                                       headerTitle: governorate ? `صيدليات وأطباء ${governorate}` : "الصيدليات والأطباء",
                                       headerTitleAlign: "center",
                                       headerBackTitle: "رجوع",
                                     }}
                                   />

                                   <View style={styles.mapWrap}>
                                     {Platform.OS === "web" ? (
                                       <WebMap
                                         coords={coords}
                                         govBoundary={govBoundary}
                                         isNavigating={isNavigating}
                                         routeCoords={routeCoords}
                                         heading={heading}
                                         destination={destination}
                                         pharmacies={pharmacies}
                                         onSelectPharmacy={handleSelectPharmacy}
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
                                         pharmacies={pharmacies}
                                         onSelectPharmacy={handleSelectPharmacy}
                                       />
                                     )}

                                     {isNavigating && navInstruction ? (
                                       <View style={styles.instructionCard}>
                                         <View style={styles.instructionRow}>
                                           <View style={styles.turnIconWrap}>
                                             <Feather name={getManeuverIcon(navManeuverType)} size={28} color="#06111A" />
                                           </View>
                                           <View style={{ flex: 1 }}>
                                             <Text style={styles.instructionDist}>{navDistance}</Text>
                                             <Text style={styles.instructionText} numberOfLines={2}>{navInstruction}</Text>
                                           </View>
                                         </View>
                                       </View>
                                     ) : null}

                                     {/* زر إعادة التمركز على الموقع */}
                                     {isNavigating && !isCameraFollowing ? (
                                       <TouchableOpacity
                                         style={styles.recenterBtn}
                                         onPress={() => setIsCameraFollowing(true)}
                                       >
                                         <Feather name="navigation" size={20} color={ACCENT} />
                                       </TouchableOpacity>
                                     ) : null}

                                     {selectedPharmacy && !isNavigating ? (
                                       <View style={styles.pharmacyCard}>
                                         {/* زر إغلاق */}
                                         <TouchableOpacity
                                           style={styles.pharmacyCloseBtn}
                                           onPress={() => setSelectedPharmacy(null)}
                                         >
                                           <Feather name="x" size={16} color="#94A3B8" />
                                         </TouchableOpacity>

                                         {/* صورة الصيدلية */}
                                         <View style={styles.pharmacyPhotoWrap}>
                                           <View style={styles.pharmacyPhotoPlaceholder}>
                                             <Feather name="plus-square" size={28} color={ACCENT} />
                                           </View>
                                         </View>

                                         {/* المعلومات */}
                                         <View style={styles.pharmacyInfo}>
                                           <Text style={styles.pharmacyName}>{selectedPharmacy.name}</Text>

                                           <View style={styles.pharmacyRow}>
                                             <View style={[styles.statusBadge, { backgroundColor: selectedPharmacy.isOpen ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }]}>
                                               <View style={[styles.statusDot, { backgroundColor: selectedPharmacy.isOpen ? "#22C55E" : "#EF4444" }]} />
                                               <Text style={[styles.statusText, { color: selectedPharmacy.isOpen ? "#22C55E" : "#EF4444" }]}>
                                                 {selectedPharmacy.isOpen ? "مفتوحة الآن" : "مغلقة"}
                                               </Text>
                                             </View>
                                             <Text style={styles.pharmacyRating}>⭐ {selectedPharmacy.rating}</Text>
                                             <Text style={styles.pharmacyDist}>{selectedPharmacy.distanceText}</Text>
                                           </View>

                                           <View style={styles.pharmacyHoursRow}>
                                             <Feather name="clock" size={12} color="#94A3B8" />
                                             <Text style={styles.pharmacyHours}>{selectedPharmacy.workingHours}</Text>
                                           </View>

                                           {/* الأزرار */}
                                           <View style={styles.pharmacyBtns}>
                                             <TouchableOpacity style={styles.searchMedBtn}>
                                               <Feather name="search" size={14} color={ACCENT} />
                                               <Text style={styles.searchMedText}>البحث عن الدواء</Text>
                                             </TouchableOpacity>
                                             <TouchableOpacity
                                               style={styles.startNavBtn}
                                               onPress={() => startNavigation({ latitude: selectedPharmacy.latitude, longitude: selectedPharmacy.longitude })}
                                             >
                                               <Feather name="navigation" size={15} color="#06111A" />
                                               <Text style={styles.startNavText}>انطلق</Text>
                                             </TouchableOpacity>
                                           </View>
                                         </View>
                                       </View>
                                     ) : null}

                                     {isNavigating ? (
                                       <View style={styles.navBottomCard}>
                                         <View style={styles.navInfoRow}>
                                           <Text style={styles.navTime}>{navTotalTime || "--"}</Text>
                                           <Text style={styles.navDot}>·</Text>
                                           <Text style={styles.navDist}>{navTotalDist || "--"}</Text>
                                         </View>
                                         <TouchableOpacity style={styles.stopBtn} onPress={stopNavigation}>
                                           <Feather name="x" size={18} color="#fff" />
                                           <Text style={styles.stopText}>إنهاء</Text>
                                         </TouchableOpacity>
                                       </View>
                                     ) : null}

                                     {!isNavigating ? (
                                       <View pointerEvents="box-none" style={styles.overlayTop}>
                                         <View style={[styles.headerCard, { backgroundColor: isDark ? "rgba(15,23,42,0.92)" : CARD_BG }]}>
                                           <View style={styles.headerIconWrap}>
                                             <Feather name="map-pin" size={20} color={ACCENT} />
                                           </View>
                                           <View style={{ flex: 1 }}>
                                             <ThemedText type="h4" style={[styles.headerTitle, { color: isDark ? "#F8FAFC" : "#0F172A", textAlign: "right" }]}> 
                                               {governorate ? `صيدليات قريبة في ${governorate}` : "صيدليات قريبة منك"}
                                             </ThemedText>
                                             <ThemedText type="caption" style={[styles.headerSubtitle, { textAlign: "right" }]}>اضغط على أي صيدلية وهمية لتجربة الملاحة</ThemedText>
                                           </View>
                                         </View>

                                         {(!coords || loadingBoundary) && !errorMsg ? (
                                           <View style={[styles.statusCard, { backgroundColor: isDark ? "rgba(15,23,42,0.92)" : CARD_BG }]}>
                                             <ActivityIndicator size="small" color={ACCENT} />
                                             <ThemedText type="caption" style={styles.statusText}>{!coords ? "جاري تحديد موقعك الحالي…" : "جاري تحميل حدود المحافظة…"}</ThemedText>
                                           </View>
                                         ) : null}

                                         {errorMsg ? (
                                           <View style={[styles.statusCard, { backgroundColor: isDark ? "rgba(15,23,42,0.92)" : CARD_BG }]}>
                                             <Feather name="alert-circle" size={16} color="#F87171" />
                                             <ThemedText type="caption" style={styles.statusText}>{errorMsg}</ThemedText>
                                           </View>
                                         ) : null}
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
                               govBoundary,
                               isNavigating,
                               routeCoords,
                               heading,
                               destination,
                               pharmacies,
                               onSelectPharmacy,
                             }: {
                               mapRef: React.MutableRefObject<any>;
                               coords: Coords | null;
                               isDark: boolean;
                               govBoundary: GovBoundary | null;
                               isNavigating: boolean;
                               routeCoords: Coords[];
                               heading: number;
                               destination: Coords | null;
                               pharmacies: Pharmacy[];
                               onSelectPharmacy: (id: string) => void;
                             }) {
                               let Mapbox: any = null;
                               try {
                                 const _mod = "@rnmapbox/maps"; Mapbox = require(_mod);
                                 Mapbox.default.setAccessToken(MAPBOX_TOKEN);
                               } catch {
                                 return (
                                   <View style={[StyleSheet.absoluteFill, styles.fallback]}>
                                     <ActivityIndicator color={ACCENT} />
                                     <Text style={{ color: "#fff", marginTop: 8 }}>جاري تحميل الخريطة…</Text>
                                   </View>
                                 );
                               }

                               const { MapView, Camera, UserLocation, ShapeSource, LineLayer, FillLayer, CircleLayer, SymbolLayer } = Mapbox;
                               const center = coords ? [coords.longitude, coords.latitude] : [DEFAULT_LNG, DEFAULT_LAT];

                               const routeGeoJSON = routeCoords.length >= 2 ? {
                                 type: "Feature",
                                 geometry: { type: "LineString", coordinates: routeCoords.map((c) => [c.longitude, c.latitude]) },
                               } : null;

                               const boundaryGeoJSON = govBoundary && govBoundary.length > 0 ? {
                                 type: "Feature",
                                 geometry: { type: "Polygon", coordinates: [govBoundary.map((c) => [c.longitude, c.latitude])] },
                               } : null;

                               const pharmaciesGeoJSON = {
                                 type: "FeatureCollection",
                                 features: pharmacies.map((p) => ({
                                   type: "Feature",
                                   properties: { id: p.id, name: p.name, isOpen: p.isOpen },
                                   geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
                                 })),
                               };

                               const destGeoJSON = destination ? {
                                 type: "Feature",
                                 geometry: { type: "Point", coordinates: [destination.longitude, destination.latitude] },
                               } : null;

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
                                   <Camera
                                     zoomLevel={isNavigating ? 17.2 : 13.2}
                                     pitch={isNavigating ? 58 : 22}
                                     heading={isNavigating ? heading : 0}
                                     centerCoordinate={center}
                                     animationMode="easeTo"
                                     animationDuration={900}
                                   />

                                   <UserLocation visible={true} renderMode="native" showsUserHeadingIndicator={true} />

                                   {boundaryGeoJSON ? (
                                     <ShapeSource id="govSource" shape={boundaryGeoJSON as any}>
                                       <FillLayer id="govFill" style={{ fillColor: ACCENT, fillOpacity: isDark ? 0.05 : 0.04 }} />
                                       <LineLayer id="govLine" style={{ lineColor: ACCENT, lineWidth: 2, lineOpacity: 0.55 }} />
                                     </ShapeSource>
                                   ) : null}

                                   <ShapeSource
                                     id="pharmaciesSource"
                                     shape={pharmaciesGeoJSON as any}
                                     onPress={(e: any) => {
                                       const id = e?.features?.[0]?.properties?.id;
                                       if (id) onSelectPharmacy(id);
                                     }}
                                   >
                                     <CircleLayer id="pharmacyHalo" style={{ circleRadius: 18, circleColor: ACCENT, circleOpacity: 0.14 }} />
                                     <CircleLayer id="pharmacyDot" style={{ circleRadius: 7, circleColor: "#EFFFFF", circleStrokeColor: ACCENT, circleStrokeWidth: 3 }} />
                                     <SymbolLayer
                                       id="pharmacyLabels"
                                       style={{
                                         textField: ["get", "name"],
                                         textSize: 12,
                                         textColor: "#FFFFFF",
                                         textHaloColor: "#07111F",
                                         textHaloWidth: 1.5,
                                         textOffset: [0, 1.5],
                                         textAnchor: "top",
                                       }}
                                     />
                                   </ShapeSource>

                                   {routeGeoJSON ? (
                                     <ShapeSource id="routeSource" shape={routeGeoJSON as any}>
                                       <LineLayer id="routeGlow" style={{ lineColor: ACCENT, lineWidth: 18, lineOpacity: 0.18, lineCap: "round", lineJoin: "round" }} />
                                       <LineLayer id="routeShadow" style={{ lineColor: "#020617", lineWidth: 11, lineOpacity: 0.75, lineCap: "round", lineJoin: "round" }} />
                                       <LineLayer id="routeMain" style={{ lineColor: ACCENT, lineWidth: 7, lineCap: "round", lineJoin: "round" }} />
                                       <LineLayer id="routeInner" style={{ lineColor: "#ECFEFF", lineWidth: 2.2, lineOpacity: 0.8, lineCap: "round", lineJoin: "round" }} />
                                     </ShapeSource>
                                   ) : null}

                                   {destGeoJSON ? (
                                     <ShapeSource id="destSource" shape={destGeoJSON as any}>
                                       <CircleLayer id="destHalo" style={{ circleRadius: 20, circleColor: "#F97316", circleOpacity: 0.18 }} />
                                       <CircleLayer id="destCircle" style={{ circleRadius: 9, circleColor: "#F97316", circleStrokeColor: "#fff", circleStrokeWidth: 3 }} />
                                     </ShapeSource>
                                   ) : null}
                                 </MapView>
                               );
                             }

                             function WebMap({
                               coords,
                               govBoundary,
                               isNavigating,
                               routeCoords,
                               heading,
                               destination,
                               pharmacies,
                               onSelectPharmacy,
                             }: {
                               coords: Coords | null;
                               govBoundary: GovBoundary | null;
                               isNavigating: boolean;
                               routeCoords: Coords[];
                               heading: number;
                               destination: Coords | null;
                               pharmacies: Pharmacy[];
                               onSelectPharmacy: (id: string) => void;
                             }) {
                               const iframeRef = useRef<any>(null);
                               const center = coords ?? { latitude: DEFAULT_LAT, longitude: DEFAULT_LNG };

                               const html = useMemo(() => buildStableMapHtml(MAPBOX_TOKEN, MAPBOX_STYLE), []);

                               useEffect(() => {
                                 if (Platform.OS !== "web") return;
                                 const handler = (event: MessageEvent) => {
                                   if (event?.data?.type === "selectPharmacy" && event.data.id) onSelectPharmacy(event.data.id);
                                 };
                                 window.addEventListener("message", handler);
                                 return () => window.removeEventListener("message", handler);
                               }, [onSelectPharmacy]);

                               useEffect(() => {
                                 const payload = {
                                   type: "updateMap",
                                   center: [center.longitude, center.latitude],
                                   zoom: isNavigating ? 17 : 13,
                                   pitch: isNavigating ? 58 : 22,
                                   bearing: isNavigating ? heading : 0,
                                   user: [center.longitude, center.latitude],
                                   route: routeCoords.map((c) => [c.longitude, c.latitude]),
                                   boundary: govBoundary ? govBoundary.map((c) => [c.longitude, c.latitude]) : null,
                                   destination: destination ? [destination.longitude, destination.latitude] : null,
                                   pharmacies: pharmacies.map((p) => ({ id: p.id, name: p.name, coord: [p.longitude, p.latitude], isOpen: p.isOpen })),
                                 };
                                 iframeRef.current?.contentWindow?.postMessage(payload, "*");
                               }, [center.latitude, center.longitude, govBoundary, isNavigating, routeCoords, heading, destination, pharmacies]);

                               if (Platform.OS !== "web") return null;
                               return (
                                 <View style={StyleSheet.absoluteFill}>
                                   {React.createElement("iframe", {
                                     ref: iframeRef,
                                     srcDoc: html,
                                     style: { border: 0, width: "100%", height: "100%" },
                                     title: "TaryaqMapbox",
                                     allowFullScreen: true,
                                     onLoad: () => {
                                       setTimeout(() => {
                                         iframeRef.current?.contentWindow?.postMessage({ type: "readyPing" }, "*");
                                       }, 200);
                                     },
                                   })}
                                 </View>
                               );
                             }

                             function buildStableMapHtml(token: string, styleUrl: string) {
                               return `<!DOCTYPE html>
                             <html>
                             <head>
                             <meta charset="utf-8"/>
                             <meta name="viewport" content="width=device-width,initial-scale=1"/>
                             <script src="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.js"></script>
                             <link href="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.css" rel="stylesheet"/>
                             <style>
                               html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#07111f;overflow:hidden;}
                               .user-dot{width:22px;height:22px;background:#22D3EE;border:3px solid #fff;border-radius:999px;box-shadow:0 0 0 8px rgba(34,211,238,.15),0 8px 24px rgba(0,0,0,.45)}
                               .pharmacy-dot{width:18px;height:18px;background:#ecfeff;border:3px solid #22D3EE;border-radius:999px;box-shadow:0 0 0 8px rgba(34,211,238,.14),0 6px 18px rgba(0,0,0,.45);cursor:pointer;}
                               .dest-dot{width:22px;height:22px;background:#f97316;border:3px solid #fff;border-radius:999px;box-shadow:0 0 0 10px rgba(249,115,22,.15),0 6px 18px rgba(0,0,0,.45)}
                             </style>
                             </head>
                             <body>
                             <div id="map"></div>
                             <script>
                             mapboxgl.accessToken = '${token}';
                             var map = new mapboxgl.Map({
                               container: 'map',
                               style: '${styleUrl}',
                               center: [${DEFAULT_LNG}, ${DEFAULT_LAT}],
                               zoom: 12,
                               pitch: 22,
                               bearing: 0,
                               antialias: true
                             });
                             var loaded = false;
                             var userMarker = null;
                             var destMarker = null;
                             var pharmacyMarkers = {};
                             var pendingPayload = null;

                             function ensureSource(id, data) {
                               if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: data });
                               else map.getSource(id).setData(data);
                             }
                             function ensureLineLayer(id, source, paint) {
                               if (!map.getLayer(id)) map.addLayer({ id: id, type: 'line', source: source, paint: paint, layout: { 'line-cap': 'round', 'line-join': 'round' } });
                             }
                             function ensureFillLayer(id, source, paint) {
                               if (!map.getLayer(id)) map.addLayer({ id: id, type: 'fill', source: source, paint: paint });
                             }
                             function removeLayerAndSource(layerIds, sourceId) {
                               layerIds.forEach(function(id){ if (map.getLayer(id)) map.removeLayer(id); });
                               if (map.getSource(sourceId)) map.removeSource(sourceId);
                             }
                             function update(payload) {
                               if (!loaded) { pendingPayload = payload; return; }
                               map.easeTo({ center: payload.center, zoom: payload.zoom, pitch: payload.pitch, bearing: payload.bearing, duration: 700, essential: true });

                               if (!userMarker) {
                                 var userEl = document.createElement('div');
                                 userEl.className = 'user-dot';
                                 userMarker = new mapboxgl.Marker(userEl).setLngLat(payload.user).addTo(map);
                               } else userMarker.setLngLat(payload.user);

                               if (payload.boundary && payload.boundary.length) {
                                 ensureSource('gov', { type:'Feature', geometry:{ type:'Polygon', coordinates:[payload.boundary] } });
                                 ensureFillLayer('gov-fill', 'gov', { 'fill-color':'#22D3EE', 'fill-opacity':0.045 });
                                 ensureLineLayer('gov-line', 'gov', { 'line-color':'#22D3EE', 'line-width':2, 'line-opacity':0.5 });
                               }

                               if (payload.route && payload.route.length >= 2) {
                                 ensureSource('route', { type:'Feature', geometry:{ type:'LineString', coordinates: payload.route } });
                                 ensureLineLayer('route-glow', 'route', { 'line-color':'#22D3EE', 'line-width':18, 'line-opacity':0.18 });
                                 ensureLineLayer('route-shadow', 'route', { 'line-color':'#020617', 'line-width':11, 'line-opacity':0.75 });
                                 ensureLineLayer('route-main', 'route', { 'line-color':'#22D3EE', 'line-width':7 });
                                 ensureLineLayer('route-inner', 'route', { 'line-color':'#ECFEFF', 'line-width':2.2, 'line-opacity':0.8 });
                               } else {
                                 removeLayerAndSource(['route-inner','route-main','route-shadow','route-glow'], 'route');
                               }

                               if (payload.destination) {
                                 if (!destMarker) {
                                   var destEl = document.createElement('div');
                                   destEl.className = 'dest-dot';
                                   destMarker = new mapboxgl.Marker(destEl).setLngLat(payload.destination).addTo(map);
                                 } else destMarker.setLngLat(payload.destination);
                               } else if (destMarker) {
                                 destMarker.remove(); destMarker = null;
                               }

                               var nextIds = {};
                               (payload.pharmacies || []).forEach(function(p) {
                                 nextIds[p.id] = true;
                                 if (!pharmacyMarkers[p.id]) {
                                   var el = document.createElement('div');
                                   el.className = 'pharmacy-dot';
                                   el.title = p.name;
                                   el.onclick = function(){ window.parent.postMessage({ type:'selectPharmacy', id:p.id }, '*'); };
                                   pharmacyMarkers[p.id] = new mapboxgl.Marker(el).setLngLat(p.coord).addTo(map);
                                 } else pharmacyMarkers[p.id].setLngLat(p.coord);
                               });
                               Object.keys(pharmacyMarkers).forEach(function(id){ if (!nextIds[id]) { pharmacyMarkers[id].remove(); delete pharmacyMarkers[id]; } });
                             }

                             map.on('load', function(){
                               loaded = true;
                               if (pendingPayload) update(pendingPayload);
                             });
                             window.addEventListener('message', function(event){
                               if (event.data && event.data.type === 'updateMap') update(event.data);
                             });
                             </script>
                             </body>
                             </html>`;
                             }

                             async function fetchGovernorateBoundary(
                               regionName: string,
                               mounted: boolean,
                               setBoundary: (b: GovBoundary) => void,
                               setLoading: (l: boolean) => void,
                             ) {
                               try {
                                 setLoading(true);
                                 const apiRes = await fetch("https://www.geoboundaries.org/api/current/gbOpen/IRQ/ADM1/");
                                 const apiData = await apiRes.json();
                                 const geoRes = await fetch(apiData.gjDownloadURL);
                                 const geoData = await geoRes.json();

                                 const feature = geoData.features.find((f: any) => {
                                   const name = f.properties?.shapeName ?? f.properties?.NAME_1 ?? "";
                                   return name.toLowerCase().includes(regionName.toLowerCase()) || regionName.toLowerCase().includes(name.toLowerCase());
                                 });

                                 if (feature && mounted) {
                                   const coords = extractPolygonCoords(feature.geometry);
                                   if (coords.length > 0) setBoundary(coords);
                                 }
                               } catch {
                                 // تجاهل الخطأ حتى لا يوقف الخريطة
                               } finally {
                                 if (mounted) setLoading(false);
                               }
                             }

                             function extractPolygonCoords(geometry: any): GovBoundary {
                               if (!geometry) return [];
                               if (geometry.type === "Polygon") {
                                 return geometry.coordinates[0].map(([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng }));
                               }
                               if (geometry.type === "MultiPolygon") {
                                 let largest: GovBoundary = [];
                                 for (const poly of geometry.coordinates) {
                                   const c = poly[0].map(([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng }));
                                   if (c.length > largest.length) largest = c;
                                 }
                                 return largest;
                               }
                               return [];
                             }

                             function buildFakePharmacies(origin: Coords): Pharmacy[] {
                               const offsets = [
                                 { id: "ph-1", name: "صيدلية ترياق", dLat: 0.0046, dLng: 0.0038, rating: 4.8, isOpen: true, workingHours: "٨ص - ١٠م" },
                                 { id: "ph-2", name: "صيدلية الشفاء", dLat: -0.0038, dLng: 0.0052, rating: 4.6, isOpen: true, workingHours: "٩ص - ١١م" },
                                 { id: "ph-3", name: "صيدلية الرافدين", dLat: 0.0068, dLng: -0.0044, rating: 4.7, isOpen: true, workingHours: "٨ص - ٩م" },
                                 { id: "ph-4", name: "صيدلية النور", dLat: -0.006, dLng: -0.0035, rating: 4.4, isOpen: false, workingHours: "٨ص - ٨م" },
                                 { id: "ph-5", name: "صيدلية الحياة", dLat: 0.0018, dLng: -0.0075, rating: 4.9, isOpen: true, workingHours: "٢٤ ساعة" },
                               ];
                               return offsets.map((p) => {
                                 const latitude = origin.latitude + p.dLat;
                                 const longitude = origin.longitude + p.dLng;
                                 return {
                                   id: p.id,
                                   name: p.name,
                                   latitude,
                                   longitude,
                                   rating: p.rating,
                                   isOpen: p.isOpen,
                                   workingHours: p.workingHours,
                                   photo: "",
                                   distanceText: formatDistance(distanceMeters(origin, { latitude, longitude })),
                                 };
                               });
                             }

                             function distanceMeters(a: Coords, b: Coords): number {
                               const R = 6371000;
                               const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
                               const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
                               const lat1 = (a.latitude * Math.PI) / 180;
                               const lat2 = (b.latitude * Math.PI) / 180;
                               const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
                               return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
                             }

                             function roundCoord(v: number) {
                               return Math.round(v * 10000) / 10000;
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

                             // تحديد أيقونة الاتجاه حسب نوع المنعطف من Mapbox
                             function getManeuverIcon(maneuverType: string): any {
                               if (maneuverType.includes("left")) return "corner-up-left";
                               if (maneuverType.includes("right")) return "corner-up-right";
                               if (maneuverType.includes("uturn")) return "rotate-ccw";
                               if (maneuverType.includes("arrive")) return "map-pin";
                               if (maneuverType.includes("depart")) return "navigation";
                               if (maneuverType.includes("roundabout")) return "rotate-cw";
                               return "arrow-up";
                             }

                             const styles = StyleSheet.create({
                               container: { flex: 1 },
                               mapWrap: { flex: 1, position: "relative" },

                               instructionCard: {
                                 position: "absolute",
                                 top: 12,
                                 left: 12,
                                 right: 12,
                                 backgroundColor: "rgba(6,17,26,0.94)",
                                 borderRadius: 24,
                                 borderWidth: 1,
                                 borderColor: "rgba(34,211,238,0.25)",
                                 padding: 14,
                                 shadowColor: "#000",
                                 shadowOpacity: 0.28,
                                 shadowRadius: 18,
                                 shadowOffset: { width: 0, height: 8 },
                                 elevation: 8,
                               },
                               instructionRow: { flexDirection: "row", alignItems: "center", gap: 14 },
                               turnIconWrap: {
                                 width: 54,
                                 height: 54,
                                 borderRadius: 18,
                                 backgroundColor: ACCENT,
                                 alignItems: "center",
                                 justifyContent: "center",
                               },
                               instructionDist: { color: ACCENT, fontSize: 13, fontWeight: "800", marginBottom: 3 },
                               instructionText: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "right" },

                               pharmacyCard: {
                                 position: "absolute",
                                 left: 14,
                                 right: 14,
                                 bottom: 24,
                                 backgroundColor: "rgba(6,17,26,0.97)",
                                 borderRadius: 24,
                                 borderWidth: 1,
                                 borderColor: "rgba(34,211,238,0.25)",
                                 padding: 16,
                                 shadowColor: "#000",
                                 shadowOpacity: 0.35,
                                 shadowRadius: 24,
                                 shadowOffset: { width: 0, height: 10 },
                                 elevation: 10,
                               },
                               pharmacyCloseBtn: {
                                 position: "absolute",
                                 top: 12,
                                 left: 12,
                                 width: 28,
                                 height: 28,
                                 borderRadius: 14,
                                 backgroundColor: "rgba(255,255,255,0.08)",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 zIndex: 10,
                               },
                               pharmacyPhotoWrap: {
                                 marginBottom: 12,
                               },
                               pharmacyPhotoPlaceholder: {
                                 height: 90,
                                 borderRadius: 16,
                                 backgroundColor: "rgba(34,211,238,0.07)",
                                 borderWidth: 1,
                                 borderColor: "rgba(34,211,238,0.18)",
                                 alignItems: "center",
                                 justifyContent: "center",
                               },
                               pharmacyInfo: { gap: 8 },
                               pharmacyName: { color: "#fff", fontSize: 17, fontWeight: "800", textAlign: "right" },
                               pharmacyMeta: { color: "#A7F3D0", marginTop: 4, fontSize: 12, fontWeight: "600", textAlign: "right" },
                               pharmacyRow: {
                                 flexDirection: "row-reverse",
                                 alignItems: "center",
                                 gap: 8,
                                 flexWrap: "wrap",
                               },
                               statusBadge: {
                                 flexDirection: "row-reverse",
                                 alignItems: "center",
                                 gap: 5,
                                 paddingHorizontal: 8,
                                 paddingVertical: 4,
                                 borderRadius: 20,
                               },
                               statusDot: {
                                 width: 7,
                                 height: 7,
                                 borderRadius: 4,
                               },
                               statusText: { fontSize: 12, fontWeight: "700" },
                               pharmacyRating: { color: "#FCD34D", fontSize: 13, fontWeight: "700" },
                               pharmacyDist: { color: "#94A3B8", fontSize: 12, fontWeight: "600" },
                               pharmacyHoursRow: {
                                 flexDirection: "row-reverse",
                                 alignItems: "center",
                                 gap: 5,
                               },
                               pharmacyHours: { color: "#94A3B8", fontSize: 12 },
                               pharmacyBtns: {
                                 flexDirection: "row-reverse",
                                 gap: 10,
                                 marginTop: 4,
                               },
                               searchMedBtn: {
                                 flex: 1,
                                 flexDirection: "row-reverse",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 gap: 6,
                                 borderWidth: 1.5,
                                 borderColor: ACCENT,
                                 borderRadius: 16,
                                 paddingVertical: 10,
                               },
                               searchMedText: { color: ACCENT, fontWeight: "700", fontSize: 13 },
                               startNavBtn: {
                                 backgroundColor: ACCENT,
                                 borderRadius: 18,
                                 paddingHorizontal: 14,
                                 paddingVertical: 11,
                                 flexDirection: "row",
                                 alignItems: "center",
                                 gap: 6,
                               },
                               startNavText: { color: "#06111A", fontWeight: "900", fontSize: 14 },

                               navBottomCard: {
                                 position: "absolute",
                                 bottom: 14,
                                 left: 12,
                                 right: 12,
                                 backgroundColor: "rgba(6,17,26,0.94)",
                                 borderRadius: 26,
                                 borderWidth: 1,
                                 borderColor: "rgba(34,211,238,0.25)",
                                 flexDirection: "row-reverse",
                                 alignItems: "center",
                                 justifyContent: "space-between",
                                 paddingVertical: 14,
                                 paddingHorizontal: 16,
                               },
                               navInfoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
                               navTime: { color: "#fff", fontSize: 22, fontWeight: "900" },
                               navDot: { color: "#64748B", fontSize: 18 },
                               navDist: { color: "#BAE6FD", fontSize: 16, fontWeight: "700" },
                               stopBtn: {
                                 flexDirection: "row",
                                 alignItems: "center",
                                 gap: 6,
                                 backgroundColor: "#EF4444",
                                 paddingHorizontal: 16,
                                 paddingVertical: 10,
                                 borderRadius: 18,
                               },
                               stopText: { color: "#fff", fontWeight: "800", fontSize: 14 },

                               overlayTop: { position: "absolute", top: 12, left: 12, right: 12, gap: 10 },
                               headerCard: {
                                 flexDirection: "row-reverse",
                                 alignItems: "center",
                                 gap: 12,
                                 padding: 14,
                                 borderRadius: 22,
                                 borderWidth: 1,
                                 borderColor: "rgba(34,211,238,0.16)",
                                 shadowColor: "#0F172A",
                                 shadowOpacity: 0.12,
                                 shadowRadius: 14,
                                 shadowOffset: { width: 0, height: 4 },
                                 elevation: 4,
                               },
                               headerIconWrap: {
                                 width: 42,
                                 height: 42,
                                 borderRadius: 21,
                                 alignItems: "center",
                                 justifyContent: "center",
                                 backgroundColor: "rgba(34,211,238,0.12)",
                               },
                               headerTitle: { fontWeight: "800" },
                               headerSubtitle: { color: "#94A3B8", marginTop: 2 },
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
                               statusText: { color: "#E2E8F0" },

                               recenterBtn: {
                                 position: "absolute",
                                 bottom: 110,
                                 right: 16,
                                 width: 46,
                                 height: 46,
                                 borderRadius: 23,
                                 backgroundColor: "rgba(6,17,26,0.94)",
                                 borderWidth: 1,
                                 borderColor: "rgba(34,211,238,0.3)",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 shadowColor: "#000",
                                 shadowOpacity: 0.3,
                                 shadowRadius: 8,
                                 shadowOffset: { width: 0, height: 4 },
                                 elevation: 6,
                               },

                               fallback: { backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" },
                             });
