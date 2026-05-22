import React from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import Animated, { FadeIn, SlideInUp, SlideOutDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";

const BRAND_BLUE = "#2A4FCC";
const BRAND_BLUE_DEEP = "#1F40C8";

interface HealthPermissionModalProps {
  visible: boolean;
  onClose: () => void;
  onConnect?: () => void;
  onManage?: () => void;
}

export default function HealthPermissionModal({
  visible,
  onClose,
  onConnect,
  onManage,
}: HealthPermissionModalProps) {
  const { theme, isDark } = useTheme();

  const cardBg = isDark ? "#1A2035" : "#FFFFFF";
  const overlayBg = isDark ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.55)";
  const textPrimary = isDark ? "#F2F4F7" : "#1A1F2E";
  const textSecondary = isDark ? addAlpha("#FFFFFF", 0.55) : "#6B7280";
  const borderColor = isDark ? addAlpha("#FFFFFF", 0.07) : "rgba(15,23,42,0.06)";

  const handleConnect = () => {
    onClose();
    if (onConnect) onConnect();
    // TODO (Phase 2): تفعيل Health Connect / HealthKit هنا
  };

  const handleManage = () => {
    onClose();
    if (onManage) onManage();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        style={[styles.overlay, { backgroundColor: overlayBg }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          entering={SlideInUp.springify().damping(18).mass(0.8)}
          exiting={SlideOutDown.duration(250)}
          style={[styles.card, { backgroundColor: cardBg, borderColor }]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* أيقونة */}
          <View style={[styles.iconWrap, { backgroundColor: addAlpha(BRAND_BLUE, 0.12) }]}>
            <Feather name="heart" size={28} color={BRAND_BLUE_DEEP} />
          </View>

          {/* العنوان */}
          <ThemedText
            type="title"
            style={[styles.title, { color: textPrimary }]}
          >
            ربط البيانات الصحية
          </ThemedText>

          {/* النص */}
          <ThemedText
            type="body"
            style={[styles.body, { color: textSecondary }]}
          >
            يساعد ترياق على قراءة مؤشراتك الصحية مثل النبض، النوم، والخطوات حتى يقدّم لك نصائح عامة وتنبيهات ذكية. هذه البيانات لا تُستخدم للتشخيص الطبي.
          </ThemedText>

          {/* تنبيه المرحلة القادمة */}
          <View style={[styles.noticeBox, { backgroundColor: addAlpha(BRAND_BLUE, 0.07), borderColor: addAlpha(BRAND_BLUE, 0.15) }]}>
            <Feather name="info" size={14} color={BRAND_BLUE} />
            <ThemedText
              type="caption"
              style={[styles.noticeText, { color: isDark ? addAlpha("#FFFFFF", 0.65) : "#374151" }]}
            >
              سيتم تفعيل الربط الحقيقي عبر Health Connect / HealthKit في المرحلة القادمة.
            </ThemedText>
          </View>

          {/* أزرار */}
          <Pressable
            style={[styles.btnPrimary, { backgroundColor: BRAND_BLUE_DEEP }]}
            onPress={handleConnect}
          >
            <Feather name="link" size={16} color="#FFF" />
            <ThemedText type="small" style={styles.btnPrimaryText}>
              ربط البيانات الصحية
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.btnSecondary, { borderColor: addAlpha(BRAND_BLUE, 0.3) }]}
            onPress={handleManage}
          >
            <ThemedText type="small" style={[styles.btnSecondaryText, { color: BRAND_BLUE }]}>
              إدارة الصلاحيات
            </ThemedText>
          </Pressable>

          <Pressable style={styles.btnGhost} onPress={onClose}>
            <ThemedText type="caption" style={{ color: textSecondary }}>
              ليس الآن
            </ThemedText>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  card: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    paddingTop: 16,
    alignItems: "center",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.3)",
    marginBottom: 20,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  noticeBox: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: 12,
    marginBottom: 20,
    width: "100%",
  },
  noticeText: {
    flex: 1,
    textAlign: "right",
    lineHeight: 18,
  },
  btnPrimary: {
    flexDirection: "row-reverse",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  btnPrimaryText: {
    color: "#FFF",
    fontWeight: "700",
  },
  btnSecondary: {
    width: "100%",
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  btnSecondaryText: {
    fontWeight: "600",
  },
  btnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
});
