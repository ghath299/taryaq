import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  Platform,
  Image,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";
import MedicineSearchMapScreen, {
  type FoundPharmacy,
} from "@/components/MedicineSearchMapScreen";
import { getApiUrl } from "@/lib/query-client";

type Step =
  | "input"
  | "confirm"
  | "searching"
  | "delivery"
  | "rate"
  | "doses"
  | "done";

interface DrugInfo {
  name: string;
  manufacturer: string;
  usage: string;
  dosage: string;
  activeIngredient: string;
  imageUri?: string;
}

const RADIUS_OPTIONS = [
  { label: "500 م", value: 500 },
  { label: "1 كم", value: 1000 },
  { label: "2 كم", value: 2000 },
  { label: "3 كم", value: 3000 },
  { label: "5 كم", value: 5000 },
];

const CANCEL_REASONS = [
  "الدواء غير مناسب",
  "وجدت الدواء بمكان آخر",
  "تأخر الرد",
  "السعر مرتفع",
  "سبب شخصي",
];

const STEP_TITLES: Record<Step, string> = {
  input: "البحث عن دواء",
  confirm: "تأكيد الدواء",
  searching: "جارٍ البحث",
  delivery: "الصيدلية في الطريق",
  rate: "قيّم الصيدلية",
  doses: "معلومات الجرعة",
  done: "تم الحفظ",
};

interface NearbyPharmacy {
  id: string;
  name: string;
  address: string;
  hours?: string;
  distanceM: number;
  rating: number;
  isAvailable: boolean;
  latitude: number;
  longitude: number;
  x?: number;
  y?: number;
}

export default function MedicineSearchScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<Step>("input");
  const [query, setQuery] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [drugInfo, setDrugInfo] = useState<DrugInfo | null>(null);
  const [searchRadius, setSearchRadius] = useState(500);
  const [isSearchingActive, setIsSearchingActive] = useState(false);
  const [foundPharmacy, setFoundPharmacy] = useState<FoundPharmacy | null>(
    null,
  );

  const [deliveryMinutes, setDeliveryMinutes] = useState(15);
  const [extensionCount, setExtensionCount] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const [rating, setRating] = useState(0);

  // ── Not-drug error state (success: false from API) ───────────────────────────
  const [notDrugError, setNotDrugError] = useState<{
    message: string;
    actions: { key: string; label: string }[];
  } | null>(null);

  // Dose info — pillsInBox replaces the old "total pills" manual field
  const [dailyDoses, setDailyDoses] = useState(2);
  const [pillsPerDose, setPillsPerDose] = useState(1);
  const [pillsInBox, setPillsInBox] = useState(20);
  const [isChronic, setIsChronic] = useState(false);

  // Location & routing
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [routeCoords, setRouteCoords] = useState<
    { latitude: number; longitude: number }[] | null
  >(null);

  const cardBg = isDark ? theme.card : "#FFFFFF";
  const subtleBorder = isDark ? "#21262D" : "#E5EEF5";

  // ── Watch real GPS location live ────────────────────────────────────────────
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const startWatchingLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          console.log("Location permission denied");
          return;
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 3,
          },
          (loc) => {
            setUserLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          },
        );
      } catch (error) {
        console.log("Location watch error:", error);
      }
    };

    startWatchingLocation();

    return () => {
      subscription?.remove();
    };
  }, []);

  // ── Computed: auto days-supply from box size ─────────────────────────────────
  const dailyConsumption = dailyDoses * pillsPerDose;
  const daysSupply =
    isChronic || dailyConsumption === 0
      ? null
      : Math.floor(pillsInBox / dailyConsumption);
  const endDate = daysSupply
    ? new Date(Date.now() + daysSupply * 86400000).toLocaleDateString("ar-IQ")
    : null;

  // ── Drug recognition via API (Gemini or mock fallback) ──────────────────────
  const recognizeDrug = useCallback(
    async (name: string, imageUri?: string, imageBase64?: string) => {
      if (!name.trim() && !imageBase64) return;
      setIsRecognizing(true);
      setNotDrugError(null);
      try {
        const body: Record<string, string> = {};
        if (name.trim()) body.medicationName = name.trim();
        if (imageBase64) {
          // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,")
          body.imageBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
        }

        const resp = await fetch(`${getApiUrl()}/api/medication/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        let data: {
          success?: boolean;
          name?: string;
          medicationName?: string;
          manufacturer?: string;
          usage?: string;
          dosage?: string;
          activeIngredient?: string;
          error?: string;
          message?: string;
          funnyMessage?: string;
          code?: string;
          actions?: { key: string; label: string }[];
        };

        try {
          data = await resp.json();
        } catch {
          throw new Error(
            "لم نتمكن من قراءة رد الخادم. تأكد من الاتصال وأعد المحاولة.",
          );
        }

        if (!resp.ok) {
          throw new Error(
            data.error ?? data.message ?? `خطأ في الخادم (${resp.status})`,
          );
        }

        // ── Server signals the image is not a drug ──────────────────────────
        if (data.success === false) {
          setNotDrugError({
            message:
              data.funnyMessage ??
              data.message ??
              "الصورة لا تحتوي على دواء واضح",
            actions: data.actions ?? [
              { key: "retake", label: "إعادة التصوير" },
              { key: "search_by_name", label: "البحث بالاسم" },
              { key: "gallery", label: "فتح المعرض" },
            ],
          });
          return;
        }

        setDrugInfo({
          name: data.name ?? data.medicationName ?? name,
          manufacturer: data.manufacturer ?? "",
          usage: data.usage ?? "",
          dosage: data.dosage ?? "",
          activeIngredient: data.activeIngredient ?? "",
          imageUri,
        });
        setStep("confirm");
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "تعذّر التعرف على الدواء. تأكد من الاتصال وأعد المحاولة.";
        Alert.alert("خطأ في التعرف على الدواء", msg, [{ text: "حسناً" }]);
      } finally {
        setIsRecognizing(false);
      }
    },
    [],
  );

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("الإذن مرفوض", "يرجى السماح للتطبيق بالوصول إلى معرض الصور");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.4,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      await recognizeDrug(
        "",
        result.assets[0].uri,
        result.assets[0].base64 ?? undefined,
      );
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("الإذن مرفوض", "يرجى السماح للتطبيق بالوصول إلى الكاميرا");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.4,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      await recognizeDrug(
        "",
        result.assets[0].uri,
        result.assets[0].base64 ?? undefined,
      );
    }
  };

  // ── After pharmacy accepts: fetch street route ───────────────────────────────
  const handlePharmacyFound = useCallback(
    async (pharmacy: FoundPharmacy) => {
      setFoundPharmacy(pharmacy);
      setIsSearchingActive(false);
      setDeliveryMinutes(Math.round((pharmacy.distanceM / 1000) * 5) + 10);

      if (userLocation) {
        try {
          const resp = await fetch(`${getApiUrl()}/api/medication/route`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fromLat: userLocation.latitude,
              fromLng: userLocation.longitude,
              toLat: pharmacy.latitude,
              toLng: pharmacy.longitude,
            }),
          });
          if (resp.ok) {
            const data = (await resp.json()) as {
              coordinates?: { latitude: number; longitude: number }[];
            };
            if (data.coordinates) setRouteCoords(data.coordinates);
          }
        } catch {
          // routing failed — map will show straight line or no line
        }
      }

      setTimeout(() => setStep("delivery"), 800);
    },
    [userLocation],
  );

  const startSearch = () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSearchingActive(true);
  };

  const handleExtend = (extra: number) => {
    if (extensionCount >= 2) {
      Alert.alert("تنبيه", "لا يمكن تمديد الوقت أكثر من مرتين");
      return;
    }
    setDeliveryMinutes((prev) => prev + extra);
    setExtensionCount((prev) => prev + 1);
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCancel = () => {
    const reason = cancelReason === "سبب شخصي" ? customReason : cancelReason;
    if (!reason.trim()) {
      Alert.alert("مطلوب", "يرجى اختيار سبب الإلغاء");
      return;
    }
    setShowCancelModal(false);
    setStep("input");
    setIsSearchingActive(false);
    setFoundPharmacy(null);
    setRouteCoords(null);
    setDrugInfo(null);
    setQuery("");
  };

  const handleConfirmReceipt = () => setStep("rate");

  const handleSubmitRating = () => {
    if (rating === 0) {
      Alert.alert("مطلوب", "يرجى تقييم الصيدلية");
      return;
    }
    setStep("doses");
  };

  const handleSaveDoses = () => {
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep("done");
  };

  const goBack = () => {
    const backMap: Partial<Record<Step, Step>> = {
      confirm: "input",
      searching: "confirm",
    };
    const prev = backMap[step];
    if (prev) {
      setStep(prev);
      if (step === "searching") setIsSearchingActive(false);
    } else router.back();
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: subtleBorder }]}>
        <Pressable
          onPress={goBack}
          style={styles.headerBtn}
          accessibilityRole="button"
        >
          <Feather name="arrow-right" size={22} color={theme.text} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <ThemedText
            type="h3"
            style={{ color: theme.text, fontWeight: "800" }}
          >
            {STEP_TITLES[step]}
          </ThemedText>
          {step === "input" && (
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginTop: 1 }}
            >
              ابحث عن دوائك في أقرب الصيدليات
            </ThemedText>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {step === "input" && (
        <StepInput
          query={query}
          onQueryChange={setQuery}
          isRecognizing={isRecognizing}
          onSearch={() => recognizeDrug(query)}
          onCamera={pickFromCamera}
          onGallery={pickFromGallery}
          notDrugError={notDrugError}
          onDismissError={() => setNotDrugError(null)}
          userLocation={userLocation}
          theme={theme}
          isDark={isDark}
          cardBg={cardBg}
          subtleBorder={subtleBorder}
          insets={insets}
        />
      )}

      {step === "confirm" && drugInfo && (
        <StepConfirm
          drug={drugInfo}
          onConfirm={() => setStep("searching")}
          onChange={() => setStep("input")}
          theme={theme}
          isDark={isDark}
          cardBg={cardBg}
          subtleBorder={subtleBorder}
          insets={insets}
        />
      )}

      {step === "searching" && drugInfo && (
        <StepSearching
          drug={drugInfo}
          searchRadius={searchRadius}
          onRadiusChange={setSearchRadius}
          isSearchingActive={isSearchingActive}
          onStartSearch={startSearch}
          onPharmacyFound={handlePharmacyFound}
          onCancel={() => setShowCancelModal(true)}
          userLocation={userLocation}
          theme={theme}
          isDark={isDark}
          cardBg={cardBg}
          subtleBorder={subtleBorder}
          insets={insets}
        />
      )}

      {step === "delivery" && foundPharmacy && (
        <StepDelivery
          pharmacy={foundPharmacy}
          drug={drugInfo!}
          deliveryMinutes={deliveryMinutes}
          extensionCount={extensionCount}
          onExtend={handleExtend}
          onConfirmReceipt={handleConfirmReceipt}
          onCancel={() => setShowCancelModal(true)}
          userLocation={userLocation}
          routeCoords={routeCoords}
          theme={theme}
          isDark={isDark}
          cardBg={cardBg}
          subtleBorder={subtleBorder}
          insets={insets}
        />
      )}

      {step === "rate" && foundPharmacy && (
        <StepRate
          pharmacy={foundPharmacy}
          rating={rating}
          onRate={setRating}
          onSubmit={handleSubmitRating}
          theme={theme}
          isDark={isDark}
          cardBg={cardBg}
          subtleBorder={subtleBorder}
          insets={insets}
        />
      )}

      {step === "doses" && drugInfo && (
        <StepDoses
          drug={drugInfo}
          dailyDoses={dailyDoses}
          pillsPerDose={pillsPerDose}
          pillsInBox={pillsInBox}
          isChronic={isChronic}
          daysSupply={daysSupply}
          endDate={endDate}
          onDailyDoses={setDailyDoses}
          onPillsPerDose={setPillsPerDose}
          onPillsInBox={setPillsInBox}
          onChronic={setIsChronic}
          onSave={handleSaveDoses}
          theme={theme}
          isDark={isDark}
          cardBg={cardBg}
          subtleBorder={subtleBorder}
          insets={insets}
        />
      )}

      {step === "done" && (
        <StepDone
          drug={drugInfo!}
          pharmacy={foundPharmacy!}
          daysSupply={daysSupply}
          endDate={endDate}
          isChronic={isChronic}
          onHome={() => router.replace("/(tabs)")}
          onMyMeds={() => router.push("/my-medications")}
          theme={theme}
          isDark={isDark}
          cardBg={cardBg}
          subtleBorder={subtleBorder}
          insets={insets}
        />
      )}

      <Modal visible={showCancelModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[styles.modalSheet, { backgroundColor: cardBg }]}
          >
            <ThemedText
              type="h3"
              style={{
                color: theme.text,
                fontWeight: "800",
                textAlign: "right",
                marginBottom: Spacing.md,
              }}
            >
              سبب الإلغاء
            </ThemedText>
            {CANCEL_REASONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setCancelReason(r)}
                style={[
                  styles.reasonRow,
                  {
                    borderColor:
                      cancelReason === r ? theme.primaryDark : subtleBorder,
                    backgroundColor:
                      cancelReason === r
                        ? addAlpha(theme.primaryDark, 0.07)
                        : "transparent",
                  },
                ]}
              >
                <View
                  style={[
                    styles.radioOuter,
                    {
                      borderColor:
                        cancelReason === r
                          ? theme.primaryDark
                          : theme.textSecondary,
                    },
                  ]}
                >
                  {cancelReason === r && (
                    <View
                      style={[
                        styles.radioInner,
                        { backgroundColor: theme.primaryDark },
                      ]}
                    />
                  )}
                </View>
                <ThemedText
                  type="body"
                  style={{
                    color: theme.text,
                    marginRight: Spacing.sm,
                    flex: 1,
                    textAlign: "right",
                  }}
                >
                  {r}
                </ThemedText>
              </Pressable>
            ))}
            {cancelReason === "سبب شخصي" && (
              <TextInput
                value={customReason}
                onChangeText={setCustomReason}
                placeholder="اكتب السبب هنا..."
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.customReasonInput,
                  { color: theme.text, borderColor: subtleBorder },
                ]}
                textAlign="right"
                multiline
              />
            )}
            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setShowCancelModal(false)}
                style={[styles.modalBtn, { borderColor: subtleBorder }]}
              >
                <ThemedText
                  type="body"
                  style={{ color: theme.textSecondary, fontWeight: "700" }}
                >
                  رجوع
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleCancel}
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme.error, borderColor: theme.error },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#fff", fontWeight: "700" }}
                >
                  تأكيد الإلغاء
                </ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Shared prop types ──────────────────────────────────────────────────────────

interface BaseProps {
  theme: ReturnType<typeof useTheme>["theme"];
  isDark: boolean;
  cardBg: string;
  subtleBorder: string;
  insets: { bottom: number };
}

// ── Step: input ────────────────────────────────────────────────────────────────

function StepInput({
  query,
  onQueryChange,
  isRecognizing,
  onSearch,
  onCamera,
  onGallery,
  notDrugError,
  onDismissError,
  userLocation,
  theme,
  isDark,
  cardBg,
  subtleBorder,
  insets,
}: BaseProps & {
  query: string;
  onQueryChange: (v: string) => void;
  isRecognizing: boolean;
  onSearch: () => void;
  onCamera: () => void;
  onGallery: () => void;
  notDrugError: {
    message: string;
    actions: { key: string; label: string }[];
  } | null;
  onDismissError: () => void;
  userLocation: { latitude: number; longitude: number } | null;
}) {
  const [showScanSheet, setShowScanSheet] = useState(false);
  const [pharmacies, setPharmacies] = useState<NearbyPharmacy[]>([]);
  const [isLoadingPharmacies, setIsLoadingPharmacies] = useState(true);
  const lastFetchedLocation = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const scanPulse = useSharedValue(1);
  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scanPulse.value }],
    opacity: 0.65 + (scanPulse.value - 1) * 2,
  }));

  useEffect(() => {
    scanPulse.value = withRepeat(
      withTiming(1.22, { duration: 950, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  useEffect(() => {
    const curr = userLocation;
    const prev = lastFetchedLocation.current;

    // تجنب إعادة الفتش إذا التغيير أقل من 200 متر
    if (prev && curr) {
      const dlat = (curr.latitude - prev.latitude) * 111000;
      const dlng =
        (curr.longitude - prev.longitude) *
        111000 *
        Math.cos((curr.latitude * Math.PI) / 180);
      if (Math.sqrt(dlat * dlat + dlng * dlng) < 200) return;
    }

    lastFetchedLocation.current = curr;
    let mounted = true;
    setIsLoadingPharmacies(true);
    const lat = curr?.latitude ?? 32.6163;
    const lng = curr?.longitude ?? 44.0246;
    fetch(
      `${getApiUrl()}/api/pharmacy/nearby?lat=${lat}&lng=${lng}&radius=2000`,
    )
      .then((r) => r.json())
      .then((data: { pharmacies?: NearbyPharmacy[] }) => {
        if (mounted && data.pharmacies) setPharmacies(data.pharmacies);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsLoadingPharmacies(false);
      });
    return () => {
      mounted = false;
    };
  }, [userLocation]);

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Not-drug error card ──────────────────────────────────────────── */}
      {notDrugError && (
        <Animated.View
          entering={FadeInDown.duration(350)}
          style={[
            styles.notDrugCard,
            {
              backgroundColor: cardBg,
              borderColor: addAlpha(theme.error ?? "#E53E3E", 0.35),
              marginHorizontal: Spacing.lg,
              marginTop: Spacing.md,
            },
          ]}
        >
          <View
            style={[
              styles.notDrugIconWrap,
              { backgroundColor: addAlpha(theme.error ?? "#E53E3E", 0.1) },
            ]}
          >
            <MaterialCommunityIcons
              name="image-off-outline"
              size={36}
              color={theme.error ?? "#E53E3E"}
            />
          </View>
          <ThemedText
            type="body"
            style={{
              color: theme.text,
              fontWeight: "800",
              textAlign: "center",
              marginTop: Spacing.md,
            }}
          >
            لم يُتعرَّف على دواء
          </ThemedText>
          <ThemedText
            type="small"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: Spacing.xs,
              lineHeight: 22,
            }}
          >
            {notDrugError.message}
          </ThemedText>
          <View style={styles.notDrugActions}>
            <Pressable
              onPress={() => {
                onDismissError();
                setShowScanSheet(true);
              }}
              style={({ pressed }) => [
                styles.notDrugBtn,
                {
                  backgroundColor: theme.primaryDark,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather name="camera" size={15} color="#fff" />
              <ThemedText
                type="small"
                style={{ color: "#fff", fontWeight: "700", marginRight: 4 }}
              >
                إعادة التصوير
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={onDismissError}
              style={({ pressed }) => [
                styles.notDrugBtnOutline,
                { borderColor: subtleBorder, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, fontWeight: "700" }}
              >
                إلغاء
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* ── Search bar ───────────────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInUp.duration(450)}
        style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.md }}
      >
        <View
          style={[
            styles2.searchBar,
            {
              backgroundColor: isDark ? "#161B22" : "#FFFFFF",
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
              elevation: 7,
            },
          ]}
        >
          <Pressable
            onPress={onSearch}
            style={[styles2.searchBtn, { backgroundColor: theme.primaryDark }]}
          >
            <Feather name="search" size={26} color="#fff" />
          </Pressable>
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="اكتب اسم الدواء أو المادة الفعّالة..."
            placeholderTextColor={theme.textSecondary}
            style={[styles2.searchInput, { color: theme.text, fontSize: 17 }]}
            textAlign="right"
            returnKeyType="search"
            onSubmitEditing={onSearch}
            editable={!isRecognizing}
          />
          <Pressable
            onPress={() => setShowScanSheet(true)}
            style={styles2.scanBtn}
            hitSlop={10}
          >
            <Animated.View style={scanStyle}>
              <MaterialCommunityIcons
                name="line-scan"
                size={26}
                color={theme.primaryDark}
              />
            </Animated.View>
          </Pressable>
        </View>

        {isRecognizing && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={[
              styles2.recognizingBanner,
              { backgroundColor: addAlpha(theme.primaryDark, 0.09) },
            ]}
          >
            <MaterialCommunityIcons
              name="brain"
              size={20}
              color={theme.primaryDark}
            />
            <ThemedText
              type="small"
              style={{
                color: theme.primaryDark,
                fontWeight: "700",
                marginRight: 8,
              }}
            >
              الذكاء الاصطناعي يتعرّف على الدواء...
            </ThemedText>
          </Animated.View>
        )}
      </Animated.View>

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      <Animated.View
        entering={FadeIn.delay(200).duration(500)}
        style={[
          styles2.mapContainer,
          { marginHorizontal: Spacing.lg, marginTop: 18 },
        ]}
      >
        {Platform.OS === "web" ? (
          <WebMockMap pharmacies={pharmacies} theme={theme} isDark={isDark} />
        ) : (
          <NativePharmacyMap
            pharmacies={pharmacies}
            userLocation={userLocation}
            theme={theme}
          />
        )}
      </Animated.View>

      {/* ── Nearby pharmacies section ────────────────────────────────────── */}
      <View style={{ marginHorizontal: Spacing.lg, marginTop: 18 }}>
        <View
          style={[
            styles2.nearbySection,
            { backgroundColor: isDark ? "#161B22" : "#FFFFFF" },
          ]}
        >
          <View style={styles2.nearbyHeader}>
            <Pressable style={styles2.viewAllBtn}>
              <ThemedText
                style={{
                  color: theme.primaryDark,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                عرض الكل
              </ThemedText>
              <Feather
                name="chevron-left"
                size={16}
                color={theme.primaryDark}
              />
            </Pressable>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <MaterialCommunityIcons
                name="map-marker-radius"
                size={22}
                color={theme.primaryDark}
              />
              <ThemedText
                style={{ color: theme.text, fontWeight: "800", fontSize: 22 }}
              >
                الأقرب إليّ
              </ThemedText>
            </View>
          </View>

          {isLoadingPharmacies ? (
            <>
              {[0, 1, 2].map((i) => (
                <PharmacySkeleton
                  key={i}
                  theme={theme}
                  subtleBorder={subtleBorder}
                />
              ))}
            </>
          ) : pharmacies.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <MaterialCommunityIcons
                name="pill"
                size={40}
                color={theme.textSecondary}
              />
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, marginTop: 12 }}
              >
                لا توجد صيدليات قريبة
              </ThemedText>
            </View>
          ) : (
            pharmacies.map((ph, i) => (
              <Animated.View
                key={ph.id}
                entering={FadeInUp.delay(i * 120).duration(400)}
              >
                <PharmacyCard
                  pharmacy={ph}
                  theme={theme}
                  isDark={isDark}
                  cardBg={cardBg}
                  subtleBorder={subtleBorder}
                />
              </Animated.View>
            ))
          )}
        </View>
      </View>

      {/* ── Scan Bottom Sheet ─────────────────────────────────────────────── */}
      <Modal
        visible={showScanSheet}
        transparent
        animationType="none"
        onRequestClose={() => setShowScanSheet(false)}
      >
        <Pressable
          style={styles2.sheetOverlay}
          onPress={() => setShowScanSheet(false)}
        >
          <Animated.View
            entering={FadeInDown.springify().damping(20).stiffness(220)}
            style={[
              styles2.scanSheet,
              { backgroundColor: isDark ? "#161B22" : "#FFFFFF" },
            ]}
          >
            <View
              style={[styles2.sheetHandle, { backgroundColor: subtleBorder }]}
            />
            <ThemedText
              type="body"
              style={{
                color: theme.text,
                fontWeight: "800",
                textAlign: "center",
                marginBottom: 24,
                fontSize: 18,
              }}
            >
              صوّر الدواء
            </ThemedText>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Pressable
                onPress={() => {
                  setShowScanSheet(false);
                  setTimeout(onCamera, 280);
                }}
                style={({ pressed }) => [
                  styles2.sheetOption,
                  {
                    backgroundColor: addAlpha(theme.primaryDark, 0.07),
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles2.sheetOptionIcon,
                    { backgroundColor: theme.primaryDark },
                  ]}
                >
                  <Feather name="camera" size={28} color="#fff" />
                </View>
                <ThemedText
                  type="body"
                  style={{
                    color: theme.text,
                    fontWeight: "700",
                    marginTop: 12,
                    fontSize: 16,
                  }}
                >
                  الكاميرا
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 3 }}
                >
                  صوّر علبة الدواء
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowScanSheet(false);
                  setTimeout(onGallery, 280);
                }}
                style={({ pressed }) => [
                  styles2.sheetOption,
                  {
                    backgroundColor: addAlpha(theme.primaryDark, 0.07),
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles2.sheetOptionIcon,
                    { backgroundColor: addAlpha(theme.primaryDark, 0.14) },
                  ]}
                >
                  <Feather name="image" size={28} color={theme.primaryDark} />
                </View>
                <ThemedText
                  type="body"
                  style={{
                    color: theme.text,
                    fontWeight: "700",
                    marginTop: 12,
                    fontSize: 16,
                  }}
                >
                  المعرض
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 3 }}
                >
                  اختر من صورك
                </ThemedText>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setShowScanSheet(false)}
              style={{
                marginTop: 20,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, fontWeight: "700" }}
              >
                إلغاء
              </ThemedText>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// ── Web mock map ───────────────────────────────────────────────────────────────

const MOCK_POSITIONS = [
  { left: "18%", top: "28%", rating: 4.8 },
  { left: "56%", top: "18%", rating: 4.6 },
  { left: "38%", top: "58%", rating: 4.9 },
  { left: "72%", top: "48%", rating: 4.5 },
];

function WebMockMap({
  pharmacies,
  theme,
  isDark,
}: {
  pharmacies: NearbyPharmacy[];
  theme: BaseProps["theme"];
  isDark: boolean;
}) {
  const mapBg = isDark ? "#0D1117" : "#131C2E";
  const items =
    pharmacies.length > 0
      ? pharmacies
          .slice(0, 4)
          .map((ph, i) => ({ ...MOCK_POSITIONS[i % 4], rating: ph.rating }))
      : MOCK_POSITIONS;
  return (
    <View style={{ flex: 1, backgroundColor: mapBg }}>
      {[35, 62, 20].map((t, i) => (
        <View
          key={`h${i}`}
          style={{
            position: "absolute",
            top: `${t}%` as any,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.055)",
          }}
        />
      ))}
      {[22, 50, 72].map((l, i) => (
        <View
          key={`v${i}`}
          style={{
            position: "absolute",
            left: `${l}%` as any,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: "rgba(255,255,255,0.05)",
          }}
        />
      ))}
      <View
        style={{
          position: "absolute",
          left: "44%",
          top: "43%",
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: "#fff",
          borderWidth: 4.5,
          borderColor: "#1F40C8",
          shadowColor: "#1F40C8",
          shadowOpacity: 0.9,
          shadowRadius: 10,
          elevation: 10,
        }}
      />
      {items.map((pos, i) => (
        <Animated.View
          key={i}
          entering={FadeIn.delay(260 + i * 80).duration(380)}
          style={{
            position: "absolute",
            left: pos.left as any,
            top: pos.top as any,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: "#22C55E",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2.5,
              borderColor: "rgba(255,255,255,0.88)",
              shadowColor: "#22C55E",
              shadowOpacity: 0.7,
              shadowRadius: 12,
              elevation: 10,
            }}
          >
            <MaterialCommunityIcons name="medical-bag" size={24} color="#fff" />
          </View>
          <View
            style={{
              height: 28,
              paddingHorizontal: 10,
              borderRadius: 14,
              backgroundColor: "rgba(10,12,20,0.88)",
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              marginTop: 4,
            }}
          >
            <ThemedText
              style={{ color: "#FFD700", fontSize: 14, lineHeight: 18 }}
            >
              ★
            </ThemedText>
            <ThemedText
              style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}
            >
              {pos.rating.toFixed(1)}
            </ThemedText>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

// ── Native pharmacy map ────────────────────────────────────────────────────────

function NativePharmacyMap({
  pharmacies,
  userLocation,
  theme,
}: {
  pharmacies: NearbyPharmacy[];
  userLocation: { latitude: number; longitude: number } | null;
  theme: BaseProps["theme"];
}) {
  const Maps = require("react-native-maps");
  const MapView = Maps.default;
  const { UrlTile, Marker, Circle } = Maps;
  const centre = userLocation ?? { latitude: 32.6163, longitude: 44.0246 };
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      provider={Maps.PROVIDER_DEFAULT}
      mapType="none"
      initialRegion={{
        latitude: centre.latitude,
        longitude: centre.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }}
      showsCompass={false}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      <UrlTile
        urlTemplate="https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
        maximumZ={19}
        flipY={false}
      />
      <Circle
        center={centre}
        radius={700}
        strokeColor={addAlpha(theme.primaryDark, 0.4)}
        strokeWidth={1.5}
        fillColor={addAlpha(theme.primaryDark, 0.07)}
      />
      <Marker coordinate={centre}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "#fff",
            borderWidth: 4.5,
            borderColor: "#1F40C8",
          }}
        />
      </Marker>
      {pharmacies.map((ph) => (
        <Marker
          key={ph.id}
          coordinate={{ latitude: ph.latitude, longitude: ph.longitude }}
          title={ph.name}
        >
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: "#22C55E",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2.5,
                borderColor: "rgba(255,255,255,0.9)",
              }}
            >
              <MaterialCommunityIcons
                name="medical-bag"
                size={24}
                color="#fff"
              />
            </View>
            <View
              style={{
                height: 28,
                paddingHorizontal: 10,
                borderRadius: 14,
                backgroundColor: "rgba(0,0,0,0.78)",
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                marginTop: 3,
              }}
            >
              <ThemedText
                style={{ color: "#FFD700", fontSize: 14, lineHeight: 18 }}
              >
                ★
              </ThemedText>
              <ThemedText
                style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}
              >
                {ph.rating.toFixed(1)}
              </ThemedText>
            </View>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

// ── Pharmacy card ──────────────────────────────────────────────────────────────

function PharmacyCard({
  pharmacy,
  theme,
  isDark,
  cardBg,
  subtleBorder,
}: {
  pharmacy: NearbyPharmacy;
  theme: BaseProps["theme"];
  isDark: boolean;
  cardBg: string;
  subtleBorder: string;
}) {
  const distStr =
    pharmacy.distanceM < 1000
      ? `${pharmacy.distanceM} م`
      : `${(pharmacy.distanceM / 1000).toFixed(1)} كم`;
  return (
    <View style={[styles2.pharmacyCard, { borderBottomColor: subtleBorder }]}>
      <View
        style={[
          styles2.pharmacyImg,
          { backgroundColor: addAlpha("#22C55E", 0.11) },
        ]}
      >
        <MaterialCommunityIcons name="medical-bag" size={38} color="#22C55E" />
      </View>
      <View style={{ flex: 1, marginRight: 12 }}>
        {/* الاسم */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            justifyContent: "flex-end",
          }}
        >
          <ThemedText
            numberOfLines={1}
            style={{
              color: theme.text,
              fontWeight: "800",
              fontSize: 18,
              textAlign: "right",
              flexShrink: 1,
            }}
          >
            {pharmacy.name}
          </ThemedText>
          <MaterialCommunityIcons
            name="check-decagram"
            size={17}
            color={theme.primaryDark}
          />
        </View>
        {/* العنوان */}
        <ThemedText
          numberOfLines={1}
          style={{
            color: theme.textSecondary,
            fontSize: 13,
            lineHeight: 20,
            textAlign: "right",
            marginTop: 2,
          }}
        >
          {pharmacy.address}
        </ThemedText>
        {/* الصف الثاني: تقييم + مسافة */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            marginTop: 6,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <ThemedText
              style={{
                color: theme.textSecondary,
                fontSize: 14,
                fontWeight: "600",
              }}
            >
              {distStr}
            </ThemedText>
            <Feather name="map-pin" size={13} color={theme.textSecondary} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <ThemedText
              style={{
                color: theme.textSecondary,
                fontSize: 14,
                fontWeight: "600",
              }}
            >
              {pharmacy.rating.toFixed(1)}
            </ThemedText>
            <ThemedText style={{ color: "#FFD700", fontSize: 14 }}>
              ★
            </ThemedText>
          </View>
        </View>
        {/* الصف الثالث: شارة مفتوح + ساعات + زر اتجاه */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 6,
          }}
        >
          <Pressable
            style={[
              styles2.dirBtn,
              { backgroundColor: isDark ? "#1A2332" : "#EEF2FF" },
            ]}
          >
            <Feather name="navigation" size={20} color={theme.primaryDark} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {pharmacy.hours && (
              <View
                style={{
                  backgroundColor: isDark ? "#1A2332" : "#EEF2FF",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                }}
              >
                <ThemedText
                  style={{
                    color: theme.primaryDark,
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  {pharmacy.hours}
                </ThemedText>
              </View>
            )}
            <View
              style={[
                styles2.openBadge,
                {
                  backgroundColor: pharmacy.isAvailable
                    ? addAlpha("#22C55E", 0.14)
                    : addAlpha("#EF4444", 0.14),
                },
              ]}
            >
              <ThemedText
                style={{
                  color: pharmacy.isAvailable ? "#22C55E" : "#EF4444",
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {pharmacy.isAvailable ? "مفتوح" : "مغلق"}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Pharmacy skeleton ──────────────────────────────────────────────────────────

function PharmacySkeleton({
  theme,
  subtleBorder,
}: {
  theme: BaseProps["theme"];
  subtleBorder: string;
}) {
  const shimmer = useSharedValue(0.4);
  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(0.9, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);
  const shimStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  return (
    <Animated.View
      style={[
        shimStyle,
        styles2.pharmacyCard,
        { borderBottomColor: subtleBorder },
      ]}
    >
      <View
        style={[
          styles2.pharmacyImg,
          { backgroundColor: addAlpha(theme.textSecondary, 0.15) },
        ]}
      />
      <View style={{ flex: 1, marginRight: 12, gap: 10 }}>
        <View
          style={{
            height: 20,
            borderRadius: 8,
            backgroundColor: addAlpha(theme.textSecondary, 0.2),
            width: "65%",
            alignSelf: "flex-end",
          }}
        />
        <View
          style={{
            height: 14,
            borderRadius: 6,
            backgroundColor: addAlpha(theme.textSecondary, 0.13),
            width: "88%",
            alignSelf: "flex-end",
          }}
        />
        <View
          style={{
            height: 14,
            borderRadius: 6,
            backgroundColor: addAlpha(theme.textSecondary, 0.1),
            width: "45%",
            alignSelf: "flex-end",
          }}
        />
      </View>
    </Animated.View>
  );
}

// ── Step: confirm ─────────────────────────────────────────────────────────────

function StepConfirm({
  drug,
  onConfirm,
  onChange,
  theme,
  cardBg,
  subtleBorder,
  insets,
}: BaseProps & {
  drug: DrugInfo;
  onConfirm: () => void;
  onChange: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={{
        padding: Spacing.lg,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <Animated.View entering={FadeInUp.duration(400)}>
        <View
          style={[
            styles.drugCard,
            { backgroundColor: cardBg, borderColor: subtleBorder },
          ]}
        >
          <View style={styles.drugCardHeader}>
            {drug.imageUri ? (
              <Image
                source={{ uri: drug.imageUri }}
                style={styles.drugImage}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.drugIconWrap,
                  { backgroundColor: addAlpha(theme.primaryDark, 0.1) },
                ]}
              >
                <MaterialCommunityIcons
                  name="pill"
                  size={40}
                  color={theme.primaryDark}
                />
              </View>
            )}
            <View style={{ flex: 1, marginRight: Spacing.md }}>
              <ThemedText
                type="h3"
                style={{
                  color: theme.text,
                  fontWeight: "800",
                  textAlign: "right",
                }}
              >
                {drug.name}
              </ThemedText>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, textAlign: "right" }}
              >
                {drug.manufacturer}
              </ThemedText>
            </View>
          </View>
          {[
            { label: "المادة الفعّالة", value: drug.activeIngredient },
            { label: "الاستخدام", value: drug.usage },
            { label: "الجرعة الموصى بها", value: drug.dosage },
          ].map((row) => (
            <View
              key={row.label}
              style={[styles.infoRow, { borderTopColor: subtleBorder }]}
            >
              <ThemedText
                type="small"
                style={{ color: theme.text, flex: 1, textAlign: "right" }}
              >
                {row.value}
              </ThemedText>
              <ThemedText
                type="caption"
                style={{
                  color: theme.textSecondary,
                  marginLeft: Spacing.md,
                  minWidth: 80,
                  textAlign: "left",
                }}
              >
                {row.label}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.confirmBtns}>
          <Pressable
            onPress={onChange}
            style={[styles.changeBtn, { borderColor: subtleBorder }]}
          >
            <Feather name="edit-2" size={16} color={theme.textSecondary} />
            <ThemedText
              type="body"
              style={{
                color: theme.textSecondary,
                fontWeight: "700",
                marginRight: 6,
              }}
            >
              تغيير
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, flex: 1 }]}
          >
            <LinearGradient
              colors={[theme.primary, theme.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmGrad}
            >
              <Feather name="check" size={18} color="#fff" />
              <ThemedText
                type="body"
                style={{ color: "#fff", fontWeight: "800", marginRight: 6 }}
              >
                هذا هو الدواء ✅
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ── Step: searching (map) ─────────────────────────────────────────────────────

function StepSearching({
  drug,
  searchRadius,
  onRadiusChange,
  isSearchingActive,
  onStartSearch,
  onPharmacyFound,
  onCancel,
  userLocation,
  theme,
  isDark,
  cardBg,
  subtleBorder,
  insets,
}: BaseProps & {
  drug: DrugInfo;
  searchRadius: number;
  onRadiusChange: (v: number) => void;
  isSearchingActive: boolean;
  onStartSearch: () => void;
  onPharmacyFound: (p: FoundPharmacy) => void;
  onCancel: () => void;
  userLocation: { latitude: number; longitude: number } | null;
}) {
  return (
    <ScrollView
      contentContainerStyle={{
        padding: Spacing.lg,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <Animated.View entering={FadeIn.duration(300)}>
        <View
          style={[
            styles.compactDrugRow,
            { backgroundColor: cardBg, borderColor: subtleBorder },
          ]}
        >
          <View
            style={[
              styles.compactDrugIcon,
              { backgroundColor: addAlpha(theme.primaryDark, 0.1) },
            ]}
          >
            <MaterialCommunityIcons
              name="pill"
              size={20}
              color={theme.primaryDark}
            />
          </View>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <ThemedText
              type="small"
              style={{
                color: theme.text,
                fontWeight: "800",
                textAlign: "right",
              }}
            >
              {drug.name}
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, textAlign: "right" }}
            >
              {drug.activeIngredient}
            </ThemedText>
          </View>
        </View>

        {!isSearchingActive && (
          <Animated.View entering={FadeInUp.duration(350)}>
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                textAlign: "right",
                marginBottom: Spacing.sm,
                marginTop: Spacing.md,
              }}
            >
              نطاق البحث
            </ThemedText>
            <View style={styles.radiusRow}>
              {RADIUS_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => onRadiusChange(opt.value)}
                  style={[
                    styles.radiusBtn,
                    {
                      backgroundColor:
                        searchRadius === opt.value ? theme.primaryDark : cardBg,
                      borderColor:
                        searchRadius === opt.value
                          ? theme.primaryDark
                          : subtleBorder,
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{
                      color:
                        searchRadius === opt.value
                          ? "#fff"
                          : theme.textSecondary,
                      fontWeight: "700",
                    }}
                  >
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        <View style={{ marginTop: Spacing.md }}>
          <MedicineSearchMapScreen
            drugName={drug.name}
            searchRadius={searchRadius}
            isSearching={isSearchingActive}
            onPharmacyFound={onPharmacyFound}
            showList={isSearchingActive}
            userLocation={userLocation}
          />
        </View>

        <View style={styles.searchActions}>
          {!isSearchingActive ? (
            <Pressable
              onPress={onStartSearch}
              style={({ pressed }) => [
                { opacity: pressed ? 0.88 : 1, flex: 1 },
              ]}
            >
              <LinearGradient
                colors={[theme.primary, theme.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionGrad}
              >
                <MaterialCommunityIcons name="magnify" size={20} color="#fff" />
                <ThemedText
                  type="body"
                  style={{ color: "#fff", fontWeight: "800", marginRight: 6 }}
                >
                  ابدأ البحث
                </ThemedText>
              </LinearGradient>
            </Pressable>
          ) : (
            <>
              <ThemedText
                type="small"
                style={{
                  color: theme.textSecondary,
                  textAlign: "center",
                  flex: 1,
                }}
              >
                يتم إشعار الصيدليات... الأسرع بالرد يأخذ طلبك
              </ThemedText>
              <Pressable
                onPress={onCancel}
                style={[styles.cancelSmallBtn, { borderColor: theme.error }]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: theme.error, fontWeight: "700" }}
                >
                  إلغاء
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ── Step: delivery ────────────────────────────────────────────────────────────

function StepDelivery({
  pharmacy,
  drug,
  deliveryMinutes,
  extensionCount,
  onExtend,
  onConfirmReceipt,
  onCancel,
  userLocation,
  routeCoords,
  theme,
  isDark,
  cardBg,
  subtleBorder,
  insets,
}: BaseProps & {
  pharmacy: FoundPharmacy;
  drug: DrugInfo;
  deliveryMinutes: number;
  extensionCount: number;
  onExtend: (extra: number) => void;
  onConfirmReceipt: () => void;
  onCancel: () => void;
  userLocation: { latitude: number; longitude: number } | null;
  routeCoords: { latitude: number; longitude: number }[] | null;
}) {
  return (
    <ScrollView
      contentContainerStyle={{
        padding: Spacing.lg,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <Animated.View entering={FadeInUp.duration(400)}>
        <View
          style={[
            styles.deliveryCard,
            {
              backgroundColor: addAlpha(theme.success, 0.08),
              borderColor: addAlpha(theme.success, 0.3),
            },
          ]}
        >
          <MaterialCommunityIcons
            name="check-circle"
            size={32}
            color={theme.success}
          />
          <View style={{ flex: 1, marginRight: Spacing.md }}>
            <ThemedText
              type="body"
              style={{
                color: theme.success,
                fontWeight: "800",
                textAlign: "right",
              }}
            >
              قبلت الطلب!
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, textAlign: "right" }}
            >
              {pharmacy.name} · {(pharmacy.distanceM / 1000).toFixed(2)} كم
            </ThemedText>
          </View>
        </View>

        {/* Map showing route from user to pharmacy */}
        <MedicineSearchMapScreen
          drugName={drug.name}
          searchRadius={500}
          isSearching={false}
          onPharmacyFound={() => {}}
          showList={false}
          userLocation={userLocation}
          routeCoords={routeCoords}
        />

        <View
          style={[
            styles.timerCard,
            { backgroundColor: cardBg, borderColor: subtleBorder },
          ]}
        >
          <Feather name="clock" size={20} color={theme.primaryDark} />
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, textAlign: "right" }}
            >
              وقت الوصول المتوقع
            </ThemedText>
            <ThemedText
              type="h3"
              style={{
                color: theme.primaryDark,
                fontWeight: "800",
                textAlign: "right",
              }}
            >
              {deliveryMinutes} دقيقة
            </ThemedText>
          </View>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            +10 دقائق احتياطي
          </ThemedText>
        </View>

        {extensionCount < 2 && (
          <View style={styles.extendRow}>
            <ThemedText
              type="caption"
              style={{
                color: theme.textSecondary,
                marginBottom: Spacing.sm,
                textAlign: "right",
              }}
            >
              تمديد الوقت ({2 - extensionCount} مرة متبقية)
            </ThemedText>
            <View style={styles.extendBtns}>
              {[10, 15, 20].map((m) => (
                <Pressable
                  key={m}
                  onPress={() => onExtend(m)}
                  style={[
                    styles.extendBtn,
                    {
                      borderColor: theme.primaryDark,
                      backgroundColor: addAlpha(theme.primaryDark, 0.07),
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{ color: theme.primaryDark, fontWeight: "700" }}
                  >
                    +{m} د
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.deliveryActions}>
          <Pressable
            onPress={onCancel}
            style={[styles.cancelBtn, { borderColor: theme.error }]}
          >
            <ThemedText
              type="body"
              style={{ color: theme.error, fontWeight: "700" }}
            >
              إلغاء الطلب
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={onConfirmReceipt}
            style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, flex: 1 }]}
          >
            <LinearGradient
              colors={[theme.success, "#2DB54B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionGrad}
            >
              <Feather name="check" size={18} color="#fff" />
              <ThemedText
                type="body"
                style={{ color: "#fff", fontWeight: "800", marginRight: 6 }}
              >
                استلمت الدواء
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ── Step: rate ────────────────────────────────────────────────────────────────

function StepRate({
  pharmacy,
  rating,
  onRate,
  onSubmit,
  theme,
  cardBg,
  subtleBorder,
  insets,
}: BaseProps & {
  pharmacy: FoundPharmacy;
  rating: number;
  onRate: (v: number) => void;
  onSubmit: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={{
        padding: Spacing.lg,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <Animated.View
        entering={ZoomIn.duration(400)}
        style={{ alignItems: "center" }}
      >
        <View
          style={[
            styles.rateIcon,
            { backgroundColor: addAlpha(theme.warning, 0.1) },
          ]}
        >
          <MaterialCommunityIcons name="star" size={40} color={theme.warning} />
        </View>
        <ThemedText
          type="h3"
          style={{
            color: theme.text,
            fontWeight: "800",
            marginTop: Spacing.md,
            textAlign: "center",
          }}
        >
          قيّم {pharmacy.name}
        </ThemedText>
        <ThemedText
          type="body"
          style={{
            color: theme.textSecondary,
            marginTop: 4,
            textAlign: "center",
          }}
        >
          تقييمك يساعد المرضى الآخرين
        </ThemedText>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => onRate(star)}>
              <Feather
                name="star"
                size={40}
                color={
                  star <= rating
                    ? theme.warning
                    : addAlpha(theme.textSecondary, 0.3)
                }
                style={{ margin: 4 }}
              />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={rating === 0}
          style={({ pressed }) => [
            styles.submitBtn,
            { opacity: rating === 0 ? 0.45 : pressed ? 0.88 : 1 },
          ]}
        >
          <LinearGradient
            colors={[theme.primary, theme.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionGrad}
          >
            <ThemedText
              type="body"
              style={{ color: "#fff", fontWeight: "800" }}
            >
              {rating === 0 ? "اختر تقييمك" : "تأكيد التقييم"}
            </ThemedText>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

// ── Counter helper ────────────────────────────────────────────────────────────

function Counter({
  value,
  onChange,
  min = 1,
  max = 99,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.counterRow}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - step))}
        style={[
          styles.counterBtn,
          { backgroundColor: addAlpha(theme.primaryDark, 0.1) },
        ]}
      >
        <Feather name="minus" size={16} color={theme.primaryDark} />
      </Pressable>
      <ThemedText
        type="h3"
        style={{
          color: theme.text,
          fontWeight: "800",
          minWidth: 44,
          textAlign: "center",
        }}
      >
        {value}
      </ThemedText>
      <Pressable
        onPress={() => onChange(Math.min(max, value + step))}
        style={[
          styles.counterBtn,
          { backgroundColor: addAlpha(theme.primaryDark, 0.1) },
        ]}
      >
        <Feather name="plus" size={16} color={theme.primaryDark} />
      </Pressable>
    </View>
  );
}

// ── Step: doses ────────────────────────────────────────────────────────────────

function StepDoses({
  drug,
  dailyDoses,
  pillsPerDose,
  pillsInBox,
  isChronic,
  daysSupply,
  endDate,
  onDailyDoses,
  onPillsPerDose,
  onPillsInBox,
  onChronic,
  onSave,
  theme,
  isDark,
  cardBg,
  subtleBorder,
  insets,
}: BaseProps & {
  drug: DrugInfo;
  dailyDoses: number;
  pillsPerDose: number;
  pillsInBox: number;
  isChronic: boolean;
  daysSupply: number | null;
  endDate: string | null;
  onDailyDoses: (v: number) => void;
  onPillsPerDose: (v: number) => void;
  onPillsInBox: (v: number) => void;
  onChronic: (v: boolean) => void;
  onSave: () => void;
}) {
  const rows = [
    {
      label: "كم مرة يومياً؟",
      value: dailyDoses,
      onChange: onDailyDoses,
      min: 1,
      max: 10,
      step: 1,
    },
    {
      label: "كم قرص في المرة؟",
      value: pillsPerDose,
      onChange: onPillsPerDose,
      min: 1,
      max: 10,
      step: 1,
    },
    {
      label: "كم قرص في العلبة؟",
      value: pillsInBox,
      onChange: onPillsInBox,
      min: 5,
      max: 200,
      step: 5,
    },
  ];

  return (
    <ScrollView
      contentContainerStyle={{
        padding: Spacing.lg,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <Animated.View entering={FadeInUp.duration(400)}>
        <ThemedText
          type="body"
          style={{
            color: theme.textSecondary,
            textAlign: "right",
            marginBottom: Spacing.md,
          }}
        >
          أخبرنا عن جرعتك حتى نذكّرك قبل نفاد الدواء
        </ThemedText>

        <View
          style={[
            styles.doseCard,
            { backgroundColor: cardBg, borderColor: subtleBorder },
          ]}
        >
          {rows.map((item, i) => (
            <View
              key={item.label}
              style={[
                styles.doseRow,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: subtleBorder,
                },
              ]}
            >
              <Counter
                value={item.value}
                onChange={item.onChange}
                min={item.min}
                max={item.max}
                step={item.step}
              />
              <ThemedText
                type="body"
                style={{
                  color: theme.text,
                  fontWeight: "700",
                  textAlign: "right",
                  flex: 1,
                }}
              >
                {item.label}
              </ThemedText>
            </View>
          ))}

          <View
            style={[
              styles.doseRow,
              {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: subtleBorder,
              },
            ]}
          >
            <Pressable
              onPress={() => onChronic(!isChronic)}
              style={[
                styles.toggle,
                {
                  backgroundColor: isChronic
                    ? theme.primaryDark
                    : addAlpha(theme.textSecondary, 0.15),
                },
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  { transform: [{ translateX: isChronic ? 20 : 2 }] },
                ]}
              />
            </Pressable>
            <ThemedText
              type="body"
              style={{
                color: theme.text,
                fontWeight: "700",
                textAlign: "right",
                flex: 1,
              }}
            >
              دواء مزمن (بدون تاريخ انتهاء)
            </ThemedText>
          </View>
        </View>

        {/* Auto-calculated days supply */}
        {!isChronic && daysSupply != null && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={[
              styles.endDateCard,
              {
                backgroundColor: addAlpha(theme.primaryDark, 0.07),
                borderColor: addAlpha(theme.primaryDark, 0.2),
              },
            ]}
          >
            <Feather name="calendar" size={18} color={theme.primaryDark} />
            <View style={{ flex: 1, marginRight: Spacing.sm }}>
              <ThemedText
                type="small"
                style={{
                  color: theme.primaryDark,
                  fontWeight: "700",
                  textAlign: "right",
                }}
              >
                ينتهي الدواء في: {endDate}
              </ThemedText>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, textAlign: "right" }}
              >
                ({daysSupply} يوم · {pillsInBox} قرص ÷ {dailyDoses}×
                {pillsPerDose}/يوم)
              </ThemedText>
            </View>
          </Animated.View>
        )}

        <Pressable
          onPress={onSave}
          style={({ pressed }) => [
            styles.submitBtn,
            { opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <LinearGradient
            colors={[theme.primary, theme.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionGrad}
          >
            <Feather name="save" size={18} color="#fff" />
            <ThemedText
              type="body"
              style={{ color: "#fff", fontWeight: "800", marginRight: 6 }}
            >
              حفظ وإضافة للجدول
            </ThemedText>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

// ── Step: done ────────────────────────────────────────────────────────────────

function StepDone({
  drug,
  pharmacy,
  daysSupply,
  endDate,
  isChronic,
  onHome,
  onMyMeds,
  theme,
  cardBg,
  subtleBorder,
  insets,
}: BaseProps & {
  drug: DrugInfo | null;
  pharmacy: FoundPharmacy | null;
  daysSupply: number | null;
  endDate: string | null;
  isChronic: boolean;
  onHome: () => void;
  onMyMeds: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={{
        padding: Spacing.lg,
        paddingBottom: insets.bottom + 32,
        alignItems: "center",
      }}
    >
      <Animated.View
        entering={ZoomIn.duration(500)}
        style={{ alignItems: "center" }}
      >
        <View
          style={[
            styles.doneIcon,
            { backgroundColor: addAlpha(theme.success, 0.12) },
          ]}
        >
          <MaterialCommunityIcons
            name="check-decagram"
            size={64}
            color={theme.success}
          />
        </View>
        <ThemedText
          type="h3"
          style={{
            color: theme.text,
            fontWeight: "800",
            marginTop: Spacing.lg,
            textAlign: "center",
          }}
        >
          تم الحفظ بنجاح!
        </ThemedText>
        <ThemedText
          type="body"
          style={{
            color: theme.textSecondary,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          {isChronic
            ? "أُضيف دواؤك المزمن إلى قائمتك الدائمة"
            : `ستتلقى تذكيراً قبل يوم من انتهاء الدواء في ${endDate}`}
        </ThemedText>

        {drug && (
          <View
            style={[
              styles.doneSummary,
              {
                backgroundColor: cardBg,
                borderColor: subtleBorder,
                width: "100%",
              },
            ]}
          >
            <SummaryRow
              label="الدواء"
              value={drug.name}
              theme={theme}
              subtleBorder={subtleBorder}
            />
            {pharmacy && (
              <SummaryRow
                label="الصيدلية"
                value={pharmacy.name}
                theme={theme}
                subtleBorder={subtleBorder}
              />
            )}
            {daysSupply && !isChronic && (
              <SummaryRow
                label="الأمداد"
                value={`${daysSupply} يوم`}
                theme={theme}
                subtleBorder={subtleBorder}
              />
            )}
          </View>
        )}

        <View style={{ width: "100%", gap: Spacing.sm, marginTop: Spacing.md }}>
          <Pressable
            onPress={onMyMeds}
            style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
          >
            <LinearGradient
              colors={[theme.primary, theme.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionGrad}
            >
              <MaterialCommunityIcons name="pill" size={18} color="#fff" />
              <ThemedText
                type="body"
                style={{ color: "#fff", fontWeight: "800", marginRight: 6 }}
              >
                أدويتي الدائمة
              </ThemedText>
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={onHome}
            style={[styles.homeBtn, { borderColor: subtleBorder }]}
          >
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, fontWeight: "700" }}
            >
              الصفحة الرئيسية
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

function SummaryRow({
  label,
  value,
  theme,
  subtleBorder,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>["theme"];
  subtleBorder: string;
}) {
  return (
    <View style={[styles.summaryRow, { borderBottomColor: subtleBorder }]}>
      <ThemedText type="small" style={{ color: theme.text, fontWeight: "700" }}>
        {value}
      </ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        {label}
      </ThemedText>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { padding: Spacing.xs, width: 36 },

  searchCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    height: 52,
  },
  inputSearchBtn: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    fontFamily: "Cairo-Regular",
    fontSize: 15,
    height: 52,
  },

  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },

  imagePickRow: { flexDirection: "row", gap: Spacing.md },
  imagePickBtn: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  imagePickGrad: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },

  recognizingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },

  notDrugCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    padding: Spacing.lg,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  notDrugIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  notDrugActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    width: "100%",
  },
  notDrugBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  notDrugBtnOutline: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  drugCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  drugCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  drugIconWrap: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  drugImage: { width: 72, height: 72, borderRadius: BorderRadius.md },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  confirmBtns: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg },
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  confirmGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },

  compactDrugRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  compactDrugIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  radiusRow: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap" },
  radiusBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },

  searchActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  cancelSmallBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },

  deliveryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  timerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  extendRow: { marginTop: Spacing.md },
  extendBtns: { flexDirection: "row", gap: Spacing.sm },
  extendBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  deliveryActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
    alignItems: "center",
  },
  cancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },

  rateIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  starsRow: {
    flexDirection: "row",
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  submitBtn: { width: "100%", marginTop: Spacing.md },

  doseCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  doseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  counterRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  toggle: { width: 48, height: 28, borderRadius: 14, justifyContent: "center" },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  endDateCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },

  doneIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  doneSummary: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: Spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  customReasonInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 80,
    fontFamily: "Cairo-Regular",
    marginBottom: Spacing.md,
    textAlignVertical: "top",
  },
  modalBtns: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md },
  modalBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: "center",
  },
});

const styles2 = StyleSheet.create({
  searchBar: {
    height: 66,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    gap: 2,
    overflow: "hidden",
  },
  searchBtn: {
    width: 56,
    height: 56,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: { flex: 1, paddingHorizontal: 10, fontWeight: "500" },
  scanBtn: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  recognizingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    padding: 10,
    borderRadius: 16,
  },

  mapContainer: { height: 320, borderRadius: 30, overflow: "hidden" },

  nearbySection: { borderRadius: 28, padding: 14, overflow: "hidden" },
  nearbyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  viewAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },

  pharmacyCard: {
    height: 148,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pharmacyImg: {
    width: 92,
    height: 92,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  openBadge: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dirBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  scanSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 38,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetOption: { flex: 1, borderRadius: 24, padding: 20, alignItems: "center" },
  sheetOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
