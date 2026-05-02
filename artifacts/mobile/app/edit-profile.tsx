import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { Stack, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

const BRAND_BLUE_DEEP = "#1F40C8";
const BRAND_BLUE = "#2A4FCC";
const BANNER_CYAN = "#5CC4E6";
const AUTH_STORAGE_KEY = "@taryaq_auth";

const PRESET_AVATARS = [
  require("@/assets/images/user-avatar.png"),
  require("@/assets/images/doctor-ahmed.png"),
  require("@/assets/images/doctor-ali.png"),
  require("@/assets/images/doctor-sara.png"),
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { user, setUser } = useAuth();

  const [name, setName] = useState(user?.fullName ?? "");
  const [avatarUri, setAvatarUri] = useState<string | undefined>(user?.avatarUri);
  const [presetIndex, setPresetIndex] = useState<number | null>(
    user?.avatarUri ? null : 0,
  );
  const [saving, setSaving] = useState(false);

  const screenBg = isDark ? "#0A0F1A" : "#F5F7FB";
  const cardBg = isDark ? "#161B22" : "#FFFFFF";
  const subtleBorder = isDark ? "#21262D" : "#EFEFEF";
  const textPrimary = isDark ? "#F0F6FC" : "#0F172A";
  const textSecondary = isDark ? "#8B95A5" : "#6B7280";

  const pickImage = async () => {
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("الإذن مطلوب", "نحتاج إذن الوصول للصور لتغيير صورتك");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
        setPresetIndex(null);
      }
    } catch (e) {
      Alert.alert("خطأ", "تعذّر اختيار الصورة");
    }
  };

  const selectPreset = (idx: number) => {
    setPresetIndex(idx);
    setAvatarUri(undefined);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert("تنبيه", "الاسم يجب أن يكون حرفين على الأقل");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const updated = {
        ...user,
        fullName: trimmed,
        avatarUri: avatarUri,
      };
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      setUser(updated);
      router.back();
    } catch (e) {
      Alert.alert("خطأ", "تعذّر حفظ التغييرات");
    } finally {
      setSaving(false);
    }
  };

  const showingPresetSrc =
    presetIndex !== null && !avatarUri ? PRESET_AVATARS[presetIndex] : null;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: screenBg }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.closeBtn, { backgroundColor: cardBg, borderColor: subtleBorder }]}
              hitSlop={10}
            >
              <Feather name="x" size={20} color={textPrimary} />
            </Pressable>
            <ThemedText type="h3" style={[styles.topTitle, { color: textPrimary }]}>
              تعديل المعلومات
            </ThemedText>
            <View style={{ width: 40 }} />
          </View>

          {/* Avatar header */}
          <Animated.View entering={FadeInDown.duration(380)} style={styles.headerWrap}>
            <LinearGradient
              colors={[BRAND_BLUE_DEEP, BRAND_BLUE, BANNER_CYAN]}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerCard}
            >
              <Pressable onPress={pickImage} style={styles.avatarRing} accessibilityLabel="تغيير الصورة">
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <Image source={showingPresetSrc ?? PRESET_AVATARS[0]} style={styles.avatarImg} />
                )}
                <View style={styles.cameraBadge}>
                  <Feather name="camera" size={14} color="#FFF" />
                </View>
              </Pressable>
              <ThemedText type="small" style={styles.headerHint}>
                اضغط على الصورة لتغييرها من معرض الصور
              </ThemedText>
            </LinearGradient>
          </Animated.View>

          {/* Preset avatars */}
          <Animated.View entering={FadeInUp.delay(100).duration(380)} style={styles.sectionWrap}>
            <ThemedText type="small" style={[styles.sectionTitle, { color: textSecondary }]}>
              اختر صورة جاهزة
            </ThemedText>
            <View style={[styles.presetCard, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
              <View style={styles.presetRow}>
                {PRESET_AVATARS.map((src, idx) => {
                  const active = presetIndex === idx && !avatarUri;
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => selectPreset(idx)}
                      style={[
                        styles.presetItem,
                        active && { borderColor: BRAND_BLUE, borderWidth: 3 },
                      ]}
                    >
                      <Image source={src} style={styles.presetImg} />
                      {active ? (
                        <View style={styles.presetCheck}>
                          <Feather name="check" size={12} color="#FFF" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Animated.View>

          {/* Name input */}
          <Animated.View entering={FadeInUp.delay(160).duration(380)} style={styles.sectionWrap}>
            <ThemedText type="small" style={[styles.sectionTitle, { color: textSecondary }]}>
              الاسم الكامل
            </ThemedText>
            <View style={[styles.inputCard, { backgroundColor: cardBg, borderColor: subtleBorder }]}>
              <Feather name="user" size={18} color={textSecondary} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="اكتب اسمك الكامل"
                placeholderTextColor={textSecondary}
                style={[styles.input, { color: textPrimary }]}
                textAlign="right"
                returnKeyType="done"
                onSubmitEditing={handleSave}
                maxLength={50}
              />
            </View>
            <ThemedText type="caption" style={[styles.helperText, { color: textSecondary }]}>
              من حرفين إلى 50 حرف
            </ThemedText>
          </Animated.View>

          {/* Save button */}
          <Animated.View entering={FadeInUp.delay(220).duration(380)} style={styles.saveWrap}>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && { opacity: 0.85 },
                saving && { opacity: 0.7 },
              ]}
            >
              <LinearGradient
                colors={[BRAND_BLUE_DEEP, BRAND_BLUE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveBtnGradient}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Feather name="check" size={18} color="#FFF" />
                    <ThemedText type="body" style={styles.saveBtnText}>
                      حفظ التغييرات
                    </ThemedText>
                  </>
                )}
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={[styles.cancelBtn, { borderColor: subtleBorder }]}
            >
              <ThemedText type="body" style={{ color: textSecondary, fontWeight: "600" }}>
                إلغاء
              </ThemedText>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  topTitle: { fontWeight: "800", fontSize: 18 },
  headerWrap: { paddingHorizontal: Spacing.xl },
  headerCard: {
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
  },
  avatarRing: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 4, borderColor: "rgba(255,255,255,0.7)",
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  avatarImg: { width: 102, height: 102, borderRadius: 51 },
  cameraBadge: {
    position: "absolute", bottom: 0, left: -2,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: BRAND_BLUE_DEEP,
    borderWidth: 3, borderColor: "#FFF",
    alignItems: "center", justifyContent: "center",
  },
  headerHint: {
    color: "rgba(255,255,255,0.92)",
    marginTop: 14,
    fontSize: 12,
    textAlign: "center",
  },
  sectionWrap: { marginTop: Spacing.xl, paddingHorizontal: Spacing.xl },
  sectionTitle: {
    textAlign: "right",
    marginBottom: Spacing.sm,
    marginRight: Spacing.xs,
    fontWeight: "700",
    fontSize: 12,
  },
  presetCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  presetRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 10,
  },
  presetItem: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderColor: "transparent",
    overflow: "hidden", position: "relative",
  },
  presetImg: { width: "100%", height: "100%", borderRadius: 32 },
  presetCheck: {
    position: "absolute", bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: BRAND_BLUE,
    borderWidth: 2, borderColor: "#FFF",
    alignItems: "center", justifyContent: "center",
  },
  inputCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    padding: 0,
  },
  helperText: {
    textAlign: "right",
    marginTop: 6,
    marginRight: Spacing.xs,
    fontSize: 11,
  },
  saveWrap: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl + 8,
    gap: 12,
  },
  saveBtn: { borderRadius: BorderRadius.lg, overflow: "hidden" },
  saveBtnGradient: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  saveBtnText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
  },
});
