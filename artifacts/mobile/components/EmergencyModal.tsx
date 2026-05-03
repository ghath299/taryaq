import React, { useState } from "react";
import { View, StyleSheet, Modal, Pressable, Linking, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, SlideInUp, SlideOutDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

interface EmergencyModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EmergencyModal({ visible, onClose }: EmergencyModalProps) {
  const { theme, isDark } = useTheme();
  const [isLocating, setIsLocating] = useState(false);

  const handleClose = () => onClose();

  const handleCall122 = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Linking.openURL("tel:122");
  };

  const handleFindHospital = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLocating(true);
    try {
      if (Platform.OS !== "web") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const { latitude, longitude } = loc.coords;
          const q = encodeURIComponent("مستشفى");
          const url = Platform.select({
            ios: `comgooglemaps://?center=${latitude},${longitude}&q=${q}&zoom=14`,
            android: `geo:${latitude},${longitude}?q=${q}`,
            default: `https://www.google.com/maps/search/${q}/@${latitude},${longitude},14z`,
          });
          const fallback = `https://www.google.com/maps/search/${q}/@${latitude},${longitude},14z`;
          const canOpen = await Linking.canOpenURL(url!);
          await Linking.openURL(canOpen ? url! : fallback);
        } else {
          await Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent("مستشفى")}`);
        }
      } else {
        await Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent("مستشفى")}`);
      }
    } catch {
      await Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent("مستشفى")}`);
    } finally {
      setIsLocating(false);
      handleClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Animated.View entering={FadeIn.duration(200)} style={styles.backdropInner} />
      </Pressable>
      <Animated.View entering={SlideInUp.springify().damping(18)} exiting={SlideOutDown.duration(250)} style={[styles.sheet, { backgroundColor: isDark ? theme.card : "#FFFFFF" }]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <LinearGradient colors={["#FF4B4B", "#FF0000"]} style={styles.emergencyIcon}>
            <Feather name="alert-triangle" size={24} color="#FFF" />
          </LinearGradient>
          <ThemedText type="h3" style={{ color: "#FF4B4B", fontWeight: "700" }}>طوارئ</ThemedText>
        </View>
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: addAlpha("#FF4B4B", 0.08), borderColor: addAlpha("#FF4B4B", 0.3) }]}
            onPress={handleCall122}
          >
            <Feather name="phone-call" size={28} color="#FF4B4B" />
            <ThemedText type="h4" style={{ color: "#FF4B4B", marginTop: 8 }}>اتصال 122</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>الإسعاف والطوارئ</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: addAlpha(theme.primary, 0.08), borderColor: addAlpha(theme.primary, 0.3) }]}
            onPress={handleFindHospital}
          >
            <Feather name="map-pin" size={28} color={theme.primary} />
            <ThemedText type="h4" style={{ color: theme.primary, marginTop: 8 }}>
              {isLocating ? "جاري التحديد..." : "أقرب مستشفى"}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>فتح الخريطة</ThemedText>
          </Pressable>
        </View>
        <Pressable onPress={handleClose} style={[styles.cancelBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="body" style={{ color: theme.textSecondary, fontWeight: "600" }}>إلغاء</ThemedText>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  backdropInner: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.xl,
    paddingBottom: Spacing["5xl"],
    zIndex: 2,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: Spacing.xl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    marginBottom: Spacing.xl,
  },
  emergencyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.xl },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 4,
  },
  cancelBtn: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
});
