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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";
import MedicineSearchMapScreen, { type FoundPharmacy } from "@/components/MedicineSearchMapScreen";
import { getApiUrl } from "@/lib/query-client";

type Step = "input" | "confirm" | "searching" | "delivery" | "rate" | "doses" | "done";

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
  { label: "1 كم",  value: 1000 },
  { label: "2 كم",  value: 2000 },
  { label: "3 كم",  value: 3000 },
  { label: "5 كم",  value: 5000 },
];

const CANCEL_REASONS = [
  "الدواء غير مناسب",
  "وجدت الدواء بمكان آخر",
  "تأخر الرد",
  "السعر مرتفع",
  "سبب شخصي",
];

const STEP_TITLES: Record<Step, string> = {
  input:    "البحث عن دواء",
  confirm:  "تأكيد الدواء",
  searching:"جارٍ البحث",
  delivery: "الصيدلية في الطريق",
  rate:     "قيّم الصيدلية",
  doses:    "معلومات الجرعة",
  done:     "تم الحفظ",
};

export default function MedicineSearchScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep]             = useState<Step>("input");
  const [query, setQuery]           = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [drugInfo, setDrugInfo]     = useState<DrugInfo | null>(null);
  const [searchRadius, setSearchRadius] = useState(500);
  const [isSearchingActive, setIsSearchingActive] = useState(false);
  const [foundPharmacy, setFoundPharmacy] = useState<FoundPharmacy | null>(null);

  const [deliveryMinutes, setDeliveryMinutes] = useState(15);
  const [extensionCount, setExtensionCount]   = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason]       = useState("");
  const [customReason, setCustomReason]       = useState("");

  const [rating, setRating] = useState(0);

  // Dose info — pillsInBox replaces the old "total pills" manual field
  const [dailyDoses, setDailyDoses]   = useState(2);
  const [pillsPerDose, setPillsPerDose] = useState(1);
  const [pillsInBox, setPillsInBox]   = useState(20);
  const [isChronic, setIsChronic]     = useState(false);

  // Location & routing
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords]   = useState<{ latitude: number; longitude: number }[] | null>(null);

  const cardBg      = isDark ? theme.card : "#FFFFFF";
  const subtleBorder = isDark ? "#21262D" : "#E5EEF5";

  // ── Get real GPS location on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch {
        // permission denied or unavailable — map falls back to Baghdad
      }
    })();
  }, []);

  // ── Computed: auto days-supply from box size ─────────────────────────────────
  const dailyConsumption = dailyDoses * pillsPerDose;
  const daysSupply = isChronic || dailyConsumption === 0
    ? null
    : Math.floor(pillsInBox / dailyConsumption);
  const endDate = daysSupply
    ? new Date(Date.now() + daysSupply * 86400000).toLocaleDateString("ar-IQ")
    : null;

  // ── Drug recognition via API (Gemini or fallback) ──────────────────────────
  const recognizeDrug = useCallback(
    async (name: string, imageUri?: string, imageBase64?: string) => {
      if (!name.trim() && !imageBase64) return;
      setIsRecognizing(true);
      try {
        const body: Record<string, string> = {};
        if (name.trim())  body.medicationName = name.trim();
        if (imageBase64)  body.imageBase64    = imageBase64;

        const resp = await fetch(`${getApiUrl()}/api/medication/search`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(body),
        });

        if (!resp.ok) throw new Error("server error");

        const data = await resp.json() as {
          name?: string;
          medicationName?: string;
          manufacturer?: string;
          usage?: string;
          dosage?: string;
          activeIngredient?: string;
        };

        setDrugInfo({
          name:             data.name ?? data.medicationName ?? name,
          manufacturer:     data.manufacturer ?? "",
          usage:            data.usage ?? "",
          dosage:           data.dosage ?? "",
          activeIngredient: data.activeIngredient ?? "",
          imageUri,
        });
        setStep("confirm");
      } catch {
        Alert.alert("خطأ", "تعذّر التعرف على الدواء. تأكد من الاتصال وأعد المحاولة.");
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
      await recognizeDrug("", result.assets[0].uri, result.assets[0].base64 ?? undefined);
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
      await recognizeDrug("", result.assets[0].uri, result.assets[0].base64 ?? undefined);
    }
  };

  // ── After pharmacy accepts: fetch street route ───────────────────────────────
  const handlePharmacyFound = useCallback(async (pharmacy: FoundPharmacy) => {
    setFoundPharmacy(pharmacy);
    setIsSearchingActive(false);
    setDeliveryMinutes(Math.round((pharmacy.distanceM / 1000) * 5) + 10);

    if (userLocation) {
      try {
        const resp = await fetch(`${getApiUrl()}/api/medication/route`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromLat: userLocation.latitude,
            fromLng: userLocation.longitude,
            toLat:   pharmacy.latitude,
            toLng:   pharmacy.longitude,
          }),
        });
        if (resp.ok) {
          const data = await resp.json() as { coordinates?: { latitude: number; longitude: number }[] };
          if (data.coordinates) setRouteCoords(data.coordinates);
        }
      } catch {
        // routing failed — map will show straight line or no line
      }
    }

    setTimeout(() => setStep("delivery"), 800);
  }, [userLocation]);

  const startSearch = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSearchingActive(true);
  };

  const handleExtend = (extra: number) => {
    if (extensionCount >= 2) {
      Alert.alert("تنبيه", "لا يمكن تمديد الوقت أكثر من مرتين");
      return;
    }
    setDeliveryMinutes((prev) => prev + extra);
    setExtensionCount((prev) => prev + 1);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    if (rating === 0) { Alert.alert("مطلوب", "يرجى تقييم الصيدلية"); return; }
    setStep("doses");
  };

  const handleSaveDoses = () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep("done");
  };

  const goBack = () => {
    const backMap: Partial<Record<Step, Step>> = { confirm: "input", searching: "confirm" };
    const prev = backMap[step];
    if (prev) { setStep(prev); if (step === "searching") setIsSearchingActive(false); }
    else router.back();
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: subtleBorder }]}>
        <Pressable onPress={goBack} style={styles.headerBtn} accessibilityRole="button">
          <Feather name="arrow-right" size={22} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={{ color: theme.text, fontWeight: "800" }}>
          {STEP_TITLES[step]}
        </ThemedText>
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
          theme={theme} isDark={isDark} cardBg={cardBg} subtleBorder={subtleBorder} insets={insets}
        />
      )}

      {step === "confirm" && drugInfo && (
        <StepConfirm
          drug={drugInfo}
          onConfirm={() => setStep("searching")}
          onChange={() => setStep("input")}
          theme={theme} isDark={isDark} cardBg={cardBg} subtleBorder={subtleBorder} insets={insets}
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
          theme={theme} isDark={isDark} cardBg={cardBg} subtleBorder={subtleBorder} insets={insets}
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
          theme={theme} isDark={isDark} cardBg={cardBg} subtleBorder={subtleBorder} insets={insets}
        />
      )}

      {step === "rate" && foundPharmacy && (
        <StepRate
          pharmacy={foundPharmacy}
          rating={rating}
          onRate={setRating}
          onSubmit={handleSubmitRating}
          theme={theme} isDark={isDark} cardBg={cardBg} subtleBorder={subtleBorder} insets={insets}
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
          theme={theme} isDark={isDark} cardBg={cardBg} subtleBorder={subtleBorder} insets={insets}
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
          theme={theme} isDark={isDark} cardBg={cardBg} subtleBorder={subtleBorder} insets={insets}
        />
      )}

      <Modal visible={showCancelModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInDown.duration(300)} style={[styles.modalSheet, { backgroundColor: cardBg }]}>
            <ThemedText type="h3" style={{ color: theme.text, fontWeight: "800", textAlign: "right", marginBottom: Spacing.md }}>
              سبب الإلغاء
            </ThemedText>
            {CANCEL_REASONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setCancelReason(r)}
                style={[
                  styles.reasonRow,
                  { borderColor: cancelReason === r ? theme.primaryDark : subtleBorder, backgroundColor: cancelReason === r ? addAlpha(theme.primaryDark, 0.07) : "transparent" },
                ]}
              >
                <View style={[styles.radioOuter, { borderColor: cancelReason === r ? theme.primaryDark : theme.textSecondary }]}>
                  {cancelReason === r && <View style={[styles.radioInner, { backgroundColor: theme.primaryDark }]} />}
                </View>
                <ThemedText type="body" style={{ color: theme.text, marginRight: Spacing.sm, flex: 1, textAlign: "right" }}>
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
                style={[styles.customReasonInput, { color: theme.text, borderColor: subtleBorder }]}
                textAlign="right"
                multiline
              />
            )}
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowCancelModal(false)} style={[styles.modalBtn, { borderColor: subtleBorder }]}>
                <ThemedText type="body" style={{ color: theme.textSecondary, fontWeight: "700" }}>رجوع</ThemedText>
              </Pressable>
              <Pressable onPress={handleCancel} style={[styles.modalBtn, { backgroundColor: theme.error, borderColor: theme.error }]}>
                <ThemedText type="body" style={{ color: "#fff", fontWeight: "700" }}>تأكيد الإلغاء</ThemedText>
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

function StepInput({ query, onQueryChange, isRecognizing, onSearch, onCamera, onGallery, theme, isDark, cardBg, subtleBorder, insets }: BaseProps & {
  query: string;
  onQueryChange: (v: string) => void;
  isRecognizing: boolean;
  onSearch: () => void;
  onCamera: () => void;
  onGallery: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 24 }}>
      <Animated.View entering={FadeInUp.duration(400)}>
        <View style={[styles.searchCard, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "right", marginBottom: Spacing.sm }}>
            اكتب اسم الدواء
          </ThemedText>
          <View style={[styles.inputRow, { borderColor: subtleBorder, backgroundColor: isDark ? "#0D1117" : "#F7FAFC" }]}>
            <Pressable onPress={onSearch} style={[styles.inputSearchBtn, { backgroundColor: theme.primaryDark }]}>
              <Feather name="search" size={18} color="#fff" />
            </Pressable>
            <TextInput
              value={query}
              onChangeText={onQueryChange}
              placeholder="Panadol، باراسيتامول، ..."
              placeholderTextColor={theme.textSecondary}
              style={[styles.textInput, { color: theme.text }]}
              textAlign="right"
              returnKeyType="search"
              onSubmitEditing={onSearch}
              editable={!isRecognizing}
            />
          </View>
        </View>

        <View style={styles.orRow}>
          <View style={[styles.orLine, { backgroundColor: subtleBorder }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginHorizontal: Spacing.sm }}>أو</ThemedText>
          <View style={[styles.orLine, { backgroundColor: subtleBorder }]} />
        </View>

        <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginBottom: Spacing.md }}>
          صوّر علبة الدواء وسيتعرّف عليها الذكاء الاصطناعي تلقائياً
        </ThemedText>

        <View style={styles.imagePickRow}>
          <Pressable onPress={onCamera} style={({ pressed }) => [styles.imagePickBtn, { backgroundColor: cardBg, borderColor: subtleBorder, opacity: pressed ? 0.8 : 1 }]}>
            <LinearGradient colors={[addAlpha(theme.primaryDark, 0.12), addAlpha(theme.primaryDark, 0.05)]} style={styles.imagePickGrad}>
              <Feather name="camera" size={28} color={theme.primaryDark} />
              <ThemedText type="small" style={{ color: theme.primaryDark, fontWeight: "700", marginTop: 6 }}>الكاميرا</ThemedText>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onGallery} style={({ pressed }) => [styles.imagePickBtn, { backgroundColor: cardBg, borderColor: subtleBorder, opacity: pressed ? 0.8 : 1 }]}>
            <LinearGradient colors={[addAlpha(theme.primaryDark, 0.12), addAlpha(theme.primaryDark, 0.05)]} style={styles.imagePickGrad}>
              <Feather name="image" size={28} color={theme.primaryDark} />
              <ThemedText type="small" style={{ color: theme.primaryDark, fontWeight: "700", marginTop: 6 }}>المعرض</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>

        {isRecognizing && (
          <Animated.View entering={FadeIn.duration(300)} style={[styles.recognizingCard, { backgroundColor: addAlpha(theme.primaryDark, 0.08) }]}>
            <MaterialCommunityIcons name="brain" size={24} color={theme.primaryDark} />
            <ThemedText type="small" style={{ color: theme.primaryDark, fontWeight: "700", marginRight: 10 }}>
              الذكاء الاصطناعي يتعرّف على الدواء...
            </ThemedText>
          </Animated.View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

// ── Step: confirm ─────────────────────────────────────────────────────────────

function StepConfirm({ drug, onConfirm, onChange, theme, cardBg, subtleBorder, insets }: BaseProps & {
  drug: DrugInfo;
  onConfirm: () => void;
  onChange: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 24 }}>
      <Animated.View entering={FadeInUp.duration(400)}>
        <View style={[styles.drugCard, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
          <View style={styles.drugCardHeader}>
            {drug.imageUri ? (
              <Image source={{ uri: drug.imageUri }} style={styles.drugImage} resizeMode="cover" />
            ) : (
              <View style={[styles.drugIconWrap, { backgroundColor: addAlpha(theme.primaryDark, 0.1) }]}>
                <MaterialCommunityIcons name="pill" size={40} color={theme.primaryDark} />
              </View>
            )}
            <View style={{ flex: 1, marginRight: Spacing.md }}>
              <ThemedText type="h3" style={{ color: theme.text, fontWeight: "800", textAlign: "right" }}>{drug.name}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right" }}>{drug.manufacturer}</ThemedText>
            </View>
          </View>
          {[
            { label: "المادة الفعّالة",     value: drug.activeIngredient },
            { label: "الاستخدام",           value: drug.usage },
            { label: "الجرعة الموصى بها",  value: drug.dosage },
          ].map((row) => (
            <View key={row.label} style={[styles.infoRow, { borderTopColor: subtleBorder }]}>
              <ThemedText type="small"   style={{ color: theme.text,          flex: 1,     textAlign: "right" }}>{row.value}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.md, minWidth: 80, textAlign: "left" }}>{row.label}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.confirmBtns}>
          <Pressable onPress={onChange} style={[styles.changeBtn, { borderColor: subtleBorder }]}>
            <Feather name="edit-2" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, fontWeight: "700", marginRight: 6 }}>تغيير</ThemedText>
          </Pressable>
          <Pressable onPress={onConfirm} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, flex: 1 }]}>
            <LinearGradient colors={[theme.primary, theme.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmGrad}>
              <Feather name="check" size={18} color="#fff" />
              <ThemedText type="body" style={{ color: "#fff", fontWeight: "800", marginRight: 6 }}>هذا هو الدواء ✅</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ── Step: searching (map) ─────────────────────────────────────────────────────

function StepSearching({ drug, searchRadius, onRadiusChange, isSearchingActive, onStartSearch, onPharmacyFound, onCancel, userLocation, theme, isDark, cardBg, subtleBorder, insets }: BaseProps & {
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
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 24 }}>
      <Animated.View entering={FadeIn.duration(300)}>
        <View style={[styles.compactDrugRow, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
          <View style={[styles.compactDrugIcon, { backgroundColor: addAlpha(theme.primaryDark, 0.1) }]}>
            <MaterialCommunityIcons name="pill" size={20} color={theme.primaryDark} />
          </View>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <ThemedText type="small"   style={{ color: theme.text,          fontWeight: "800", textAlign: "right" }}>{drug.name}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary,                    textAlign: "right" }}>{drug.activeIngredient}</ThemedText>
          </View>
        </View>

        {!isSearchingActive && (
          <Animated.View entering={FadeInUp.duration(350)}>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "right", marginBottom: Spacing.sm, marginTop: Spacing.md }}>
              نطاق البحث
            </ThemedText>
            <View style={styles.radiusRow}>
              {RADIUS_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => onRadiusChange(opt.value)}
                  style={[styles.radiusBtn, { backgroundColor: searchRadius === opt.value ? theme.primaryDark : cardBg, borderColor: searchRadius === opt.value ? theme.primaryDark : subtleBorder }]}
                >
                  <ThemedText type="caption" style={{ color: searchRadius === opt.value ? "#fff" : theme.textSecondary, fontWeight: "700" }}>
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
            <Pressable onPress={onStartSearch} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, flex: 1 }]}>
              <LinearGradient colors={[theme.primary, theme.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionGrad}>
                <MaterialCommunityIcons name="magnify" size={20} color="#fff" />
                <ThemedText type="body" style={{ color: "#fff", fontWeight: "800", marginRight: 6 }}>ابدأ البحث</ThemedText>
              </LinearGradient>
            </Pressable>
          ) : (
            <>
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", flex: 1 }}>
                يتم إشعار الصيدليات... الأسرع بالرد يأخذ طلبك
              </ThemedText>
              <Pressable onPress={onCancel} style={[styles.cancelSmallBtn, { borderColor: theme.error }]}>
                <ThemedText type="caption" style={{ color: theme.error, fontWeight: "700" }}>إلغاء</ThemedText>
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ── Step: delivery ────────────────────────────────────────────────────────────

function StepDelivery({ pharmacy, drug, deliveryMinutes, extensionCount, onExtend, onConfirmReceipt, onCancel, userLocation, routeCoords, theme, isDark, cardBg, subtleBorder, insets }: BaseProps & {
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
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 32 }}>
      <Animated.View entering={FadeInUp.duration(400)}>
        <View style={[styles.deliveryCard, { backgroundColor: addAlpha(theme.success, 0.08), borderColor: addAlpha(theme.success, 0.3) }]}>
          <MaterialCommunityIcons name="check-circle" size={32} color={theme.success} />
          <View style={{ flex: 1, marginRight: Spacing.md }}>
            <ThemedText type="body" style={{ color: theme.success, fontWeight: "800", textAlign: "right" }}>
              قبلت الطلب!
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right" }}>
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

        <View style={[styles.timerCard, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
          <Feather name="clock" size={20} color={theme.primaryDark} />
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right" }}>وقت الوصول المتوقع</ThemedText>
            <ThemedText type="h3"     style={{ color: theme.primaryDark, fontWeight: "800", textAlign: "right" }}>{deliveryMinutes} دقيقة</ThemedText>
          </View>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>+10 دقائق احتياطي</ThemedText>
        </View>

        {extensionCount < 2 && (
          <View style={styles.extendRow}>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm, textAlign: "right" }}>
              تمديد الوقت ({2 - extensionCount} مرة متبقية)
            </ThemedText>
            <View style={styles.extendBtns}>
              {[10, 15, 20].map((m) => (
                <Pressable key={m} onPress={() => onExtend(m)} style={[styles.extendBtn, { borderColor: theme.primaryDark, backgroundColor: addAlpha(theme.primaryDark, 0.07) }]}>
                  <ThemedText type="caption" style={{ color: theme.primaryDark, fontWeight: "700" }}>+{m} د</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.deliveryActions}>
          <Pressable onPress={onCancel} style={[styles.cancelBtn, { borderColor: theme.error }]}>
            <ThemedText type="body" style={{ color: theme.error, fontWeight: "700" }}>إلغاء الطلب</ThemedText>
          </Pressable>
          <Pressable onPress={onConfirmReceipt} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, flex: 1 }]}>
            <LinearGradient colors={[theme.success, "#2DB54B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionGrad}>
              <Feather name="check" size={18} color="#fff" />
              <ThemedText type="body" style={{ color: "#fff", fontWeight: "800", marginRight: 6 }}>استلمت الدواء</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ── Step: rate ────────────────────────────────────────────────────────────────

function StepRate({ pharmacy, rating, onRate, onSubmit, theme, cardBg, subtleBorder, insets }: BaseProps & {
  pharmacy: FoundPharmacy;
  rating: number;
  onRate: (v: number) => void;
  onSubmit: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 32 }}>
      <Animated.View entering={ZoomIn.duration(400)} style={{ alignItems: "center" }}>
        <View style={[styles.rateIcon, { backgroundColor: addAlpha(theme.warning, 0.1) }]}>
          <MaterialCommunityIcons name="star" size={40} color={theme.warning} />
        </View>
        <ThemedText type="h3" style={{ color: theme.text, fontWeight: "800", marginTop: Spacing.md, textAlign: "center" }}>
          قيّم {pharmacy.name}
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 4, textAlign: "center" }}>
          تقييمك يساعد المرضى الآخرين
        </ThemedText>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => onRate(star)}>
              <Feather name="star" size={40} color={star <= rating ? theme.warning : addAlpha(theme.textSecondary, 0.3)} style={{ margin: 4 }} />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={onSubmit} disabled={rating === 0} style={({ pressed }) => [styles.submitBtn, { opacity: rating === 0 ? 0.45 : pressed ? 0.88 : 1 }]}>
          <LinearGradient colors={[theme.primary, theme.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionGrad}>
            <ThemedText type="body" style={{ color: "#fff", fontWeight: "800" }}>
              {rating === 0 ? "اختر تقييمك" : "تأكيد التقييم"}
            </ThemedText>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

// ── Counter helper ────────────────────────────────────────────────────────────

function Counter({ value, onChange, min = 1, max = 99, step = 1 }: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.counterRow}>
      <Pressable onPress={() => onChange(Math.max(min, value - step))} style={[styles.counterBtn, { backgroundColor: addAlpha(theme.primaryDark, 0.1) }]}>
        <Feather name="minus" size={16} color={theme.primaryDark} />
      </Pressable>
      <ThemedText type="h3" style={{ color: theme.text, fontWeight: "800", minWidth: 44, textAlign: "center" }}>
        {value}
      </ThemedText>
      <Pressable onPress={() => onChange(Math.min(max, value + step))} style={[styles.counterBtn, { backgroundColor: addAlpha(theme.primaryDark, 0.1) }]}>
        <Feather name="plus" size={16} color={theme.primaryDark} />
      </Pressable>
    </View>
  );
}

// ── Step: doses ────────────────────────────────────────────────────────────────

function StepDoses({ drug, dailyDoses, pillsPerDose, pillsInBox, isChronic, daysSupply, endDate, onDailyDoses, onPillsPerDose, onPillsInBox, onChronic, onSave, theme, isDark, cardBg, subtleBorder, insets }: BaseProps & {
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
    { label: "كم مرة يومياً؟",    value: dailyDoses,   onChange: onDailyDoses,   min: 1, max: 10, step: 1 },
    { label: "كم قرص في المرة؟",  value: pillsPerDose, onChange: onPillsPerDose, min: 1, max: 10, step: 1 },
    { label: "كم قرص في العلبة؟", value: pillsInBox,   onChange: onPillsInBox,   min: 5, max: 200, step: 5 },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 32 }}>
      <Animated.View entering={FadeInUp.duration(400)}>
        <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "right", marginBottom: Spacing.md }}>
          أخبرنا عن جرعتك حتى نذكّرك قبل نفاد الدواء
        </ThemedText>

        <View style={[styles.doseCard, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
          {rows.map((item, i) => (
            <View key={item.label} style={[styles.doseRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: subtleBorder }]}>
              <Counter value={item.value} onChange={item.onChange} min={item.min} max={item.max} step={item.step} />
              <ThemedText type="body" style={{ color: theme.text, fontWeight: "700", textAlign: "right", flex: 1 }}>
                {item.label}
              </ThemedText>
            </View>
          ))}

          <View style={[styles.doseRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: subtleBorder }]}>
            <Pressable
              onPress={() => onChronic(!isChronic)}
              style={[styles.toggle, { backgroundColor: isChronic ? theme.primaryDark : addAlpha(theme.textSecondary, 0.15) }]}
            >
              <View style={[styles.toggleThumb, { transform: [{ translateX: isChronic ? 20 : 2 }] }]} />
            </Pressable>
            <ThemedText type="body" style={{ color: theme.text, fontWeight: "700", textAlign: "right", flex: 1 }}>
              دواء مزمن (بدون تاريخ انتهاء)
            </ThemedText>
          </View>
        </View>

        {/* Auto-calculated days supply */}
        {!isChronic && daysSupply != null && (
          <Animated.View entering={FadeIn.duration(300)} style={[styles.endDateCard, { backgroundColor: addAlpha(theme.primaryDark, 0.07), borderColor: addAlpha(theme.primaryDark, 0.2) }]}>
            <Feather name="calendar" size={18} color={theme.primaryDark} />
            <View style={{ flex: 1, marginRight: Spacing.sm }}>
              <ThemedText type="small" style={{ color: theme.primaryDark, fontWeight: "700", textAlign: "right" }}>
                ينتهي الدواء في: {endDate}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "right" }}>
                ({daysSupply} يوم · {pillsInBox} قرص ÷ {dailyDoses}×{pillsPerDose}/يوم)
              </ThemedText>
            </View>
          </Animated.View>
        )}

        <Pressable onPress={onSave} style={({ pressed }) => [styles.submitBtn, { opacity: pressed ? 0.88 : 1 }]}>
          <LinearGradient colors={[theme.primary, theme.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionGrad}>
            <Feather name="save" size={18} color="#fff" />
            <ThemedText type="body" style={{ color: "#fff", fontWeight: "800", marginRight: 6 }}>حفظ وإضافة للجدول</ThemedText>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

// ── Step: done ────────────────────────────────────────────────────────────────

function StepDone({ drug, pharmacy, daysSupply, endDate, isChronic, onHome, onMyMeds, theme, cardBg, subtleBorder, insets }: BaseProps & {
  drug: DrugInfo | null;
  pharmacy: FoundPharmacy | null;
  daysSupply: number | null;
  endDate: string | null;
  isChronic: boolean;
  onHome: () => void;
  onMyMeds: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 32, alignItems: "center" }}>
      <Animated.View entering={ZoomIn.duration(500)} style={{ alignItems: "center" }}>
        <View style={[styles.doneIcon, { backgroundColor: addAlpha(theme.success, 0.12) }]}>
          <MaterialCommunityIcons name="check-decagram" size={64} color={theme.success} />
        </View>
        <ThemedText type="h3" style={{ color: theme.text, fontWeight: "800", marginTop: Spacing.lg, textAlign: "center" }}>
          تم الحفظ بنجاح!
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: 4 }}>
          {isChronic
            ? "أُضيف دواؤك المزمن إلى قائمتك الدائمة"
            : `ستتلقى تذكيراً قبل يوم من انتهاء الدواء في ${endDate}`}
        </ThemedText>

        {drug && (
          <View style={[styles.doneSummary, { backgroundColor: cardBg, borderColor: subtleBorder, width: "100%" }]}>
            <SummaryRow label="الدواء"    value={drug.name}        theme={theme} subtleBorder={subtleBorder} />
            {pharmacy    && <SummaryRow label="الصيدلية" value={pharmacy.name}   theme={theme} subtleBorder={subtleBorder} />}
            {daysSupply  && !isChronic && <SummaryRow label="الأمداد"  value={`${daysSupply} يوم`} theme={theme} subtleBorder={subtleBorder} />}
          </View>
        )}

        <View style={{ width: "100%", gap: Spacing.sm, marginTop: Spacing.md }}>
          <Pressable onPress={onMyMeds} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
            <LinearGradient colors={[theme.primary, theme.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionGrad}>
              <MaterialCommunityIcons name="pill" size={18} color="#fff" />
              <ThemedText type="body" style={{ color: "#fff", fontWeight: "800", marginRight: 6 }}>أدويتي الدائمة</ThemedText>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onHome} style={[styles.homeBtn, { borderColor: subtleBorder }]}>
            <ThemedText type="body" style={{ color: theme.textSecondary, fontWeight: "700" }}>الصفحة الرئيسية</ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

function SummaryRow({ label, value, theme, subtleBorder }: {
  label: string; value: string;
  theme: ReturnType<typeof useTheme>["theme"];
  subtleBorder: string;
}) {
  return (
    <View style={[styles.summaryRow, { borderBottomColor: subtleBorder }]}>
      <ThemedText type="small"   style={{ color: theme.text,          fontWeight: "700" }}>{value}</ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>{label}</ThemedText>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBtn: { padding: Spacing.xs, width: 36 },

  searchCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md },
  inputRow:   { flexDirection: "row", alignItems: "center", borderRadius: BorderRadius.md, borderWidth: 1, overflow: "hidden", height: 52 },
  inputSearchBtn: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  textInput:  { flex: 1, paddingHorizontal: Spacing.md, fontFamily: "Cairo-Regular", fontSize: 15, height: 52 },

  orRow:  { flexDirection: "row", alignItems: "center", marginVertical: Spacing.lg },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },

  imagePickRow: { flexDirection: "row", gap: Spacing.md },
  imagePickBtn: { flex: 1, borderRadius: BorderRadius.lg, borderWidth: 1, overflow: "hidden" },
  imagePickGrad:{ paddingVertical: Spacing.xl, alignItems: "center", justifyContent: "center" },

  recognizingCard: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.lg },

  drugCard:       { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: "hidden" },
  drugCardHeader: { flexDirection: "row", alignItems: "center", padding: Spacing.md },
  drugIconWrap:   { width: 72, height: 72, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center" },
  drugImage:      { width: 72, height: 72, borderRadius: BorderRadius.md },
  infoRow:        { flexDirection: "row", alignItems: "flex-start", padding: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },

  confirmBtns: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg },
  changeBtn:   { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, gap: 4 },
  confirmGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.full, gap: 4 },

  compactDrugRow:  { flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.sm },
  compactDrugIcon: { width: 36, height: 36, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center" },

  radiusRow: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap" },
  radiusBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.full, borderWidth: 1 },

  searchActions:   { flexDirection: "row", alignItems: "center", marginTop: Spacing.md, gap: Spacing.sm },
  actionGrad:      { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.full, gap: 6 },
  cancelSmallBtn:  { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1 },

  deliveryCard:    { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1.5, marginBottom: Spacing.md, gap: Spacing.sm },
  timerCard:       { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginTop: Spacing.md, gap: Spacing.sm },
  extendRow:       { marginTop: Spacing.md },
  extendBtns:      { flexDirection: "row", gap: Spacing.sm },
  extendBtn:       { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1 },
  deliveryActions: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg, alignItems: "center" },
  cancelBtn:       { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1 },

  rateIcon:  { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginTop: Spacing.xl },
  starsRow:  { flexDirection: "row", marginTop: Spacing.xl, marginBottom: Spacing.xl },
  submitBtn: { width: "100%", marginTop: Spacing.md },

  doseCard: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: "hidden" },
  doseRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: Spacing.md, paddingHorizontal: Spacing.md },
  counterRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  counterBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  toggle:     { width: 48, height: 28, borderRadius: 14, justifyContent: "center" },
  toggleThumb:{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  endDateCard:{ flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginTop: Spacing.md, gap: Spacing.sm },

  doneIcon:    { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center", marginTop: Spacing.xl },
  doneSummary: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: "hidden", marginTop: Spacing.lg },
  summaryRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  homeBtn:     { paddingVertical: Spacing.md, borderRadius: BorderRadius.full, borderWidth: 1, alignItems: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 40 },
  reasonRow:    { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.sm },
  radioOuter:   { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner:   { width: 10, height: 10, borderRadius: 5 },
  customReasonInput: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, minHeight: 80, fontFamily: "Cairo-Regular", marginBottom: Spacing.md, textAlignVertical: "top" },
  modalBtns:    { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md },
  modalBtn:     { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, borderWidth: 1, alignItems: "center" },
});
