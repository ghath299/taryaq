import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeIn, SlideInUp, SlideOutDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, addAlpha } from "@/constants/colors";
import {
  isHealthConnectAvailable,
  initializeHealthConnect,
  requestHealthConnectPermissions,
  openHealthConnectSettingsScreen,
} from "@/services/healthConnectAdapter";

const BRAND_BLUE      = "#2A4FCC";
const BRAND_BLUE_DEEP = "#1F40C8";

type ConnectStep = "idle" | "connecting" | "success" | "denied" | "unavailable";

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
  const { isDark } = useTheme();
  const [step, setStep] = useState<ConnectStep>("idle");

  const cardBg        = isDark ? "#1A2035" : "#FFFFFF";
  const overlayBg     = isDark ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.55)";
  const textPrimary   = isDark ? "#F2F4F7" : "#1A1F2E";
  const textSecondary = isDark ? addAlpha("#FFFFFF", 0.55) : "#6B7280";
  const borderColor   = isDark ? addAlpha("#FFFFFF", 0.07) : "rgba(15,23,42,0.06)";

  const handleConnect = async () => {
    // على Web/iOS نعرض رسالة توضيحية فقط (Health Connect Android فقط)
    if (Platform.OS !== "android") {
      setStep("unavailable");
      return;
    }

    setStep("connecting");
    try {
      const available = await isHealthConnectAvailable();
      if (!available) {
        setStep("unavailable");
        return;
      }

      await initializeHealthConnect();
      const granted = await requestHealthConnectPermissions();

      if (granted) {
        setStep("success");
        // استدعاء callback لتحديث كارد الصحة في الصفحة الرئيسية
        if (onConnect) onConnect();
      } else {
        setStep("denied");
      }
    } catch {
      setStep("denied");
    }
  };

  const handleManage = () => {
    onClose();
    if (onManage) onManage();
  };

  const handleOpenHCSettings = async () => {
    await openHealthConnectSettingsScreen();
  };

  const handleClose = () => {
    setStep("idle");
    onClose();
  };

  // ── محتوى الإشعار حسب الحالة ──────────────────────────────────────────────
  const noticeContent = (): { icon: React.ComponentProps<typeof Feather>["name"]; color: string; text: string; bg: string; border: string } => {
    switch (step) {
      case "connecting":
        return {
          icon: "loader", color: BRAND_BLUE,
          text: "جارٍ الاتصال بـ Health Connect…",
          bg: addAlpha(BRAND_BLUE, 0.07), border: addAlpha(BRAND_BLUE, 0.15),
        };
      case "success":
        return {
          icon: "check-circle", color: "#22C55E",
          text: "تم الربط! ستظهر بياناتك الحقيقية خلال لحظات.",
          bg: addAlpha("#22C55E", 0.08), border: addAlpha("#22C55E", 0.25),
        };
      case "denied":
        return {
          icon: "alert-circle", color: "#F97316",
          text: "لم تُمنح الصلاحيات. يمكنك السماح من إعدادات Health Connect.",
          bg: addAlpha("#F97316", 0.08), border: addAlpha("#F97316", 0.25),
        };
      case "unavailable":
        return {
          icon: "alert-triangle", color: "#EF4444",
          text: Platform.OS !== "android"
            ? "Health Connect متاح على Android فقط."
            : "Health Connect غير متوفر على هذا الجهاز. تأكد من تثبيت تطبيق Health Connect من Google Play.",
          bg: addAlpha("#EF4444", 0.08), border: addAlpha("#EF4444", 0.25),
        };
      default:
        return {
          icon: "info", color: BRAND_BLUE,
          text: "يعمل مع Health Connect على Android 9+. تأكد من تثبيت تطبيق Health Connect من Google Play.",
          bg: addAlpha(BRAND_BLUE, 0.07), border: addAlpha(BRAND_BLUE, 0.15),
        };
    }
  };

  const notice = noticeContent();
  const isConnecting = step === "connecting";
  const isDone = step === "success" || step === "unavailable";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        style={[styles.overlay, { backgroundColor: overlayBg }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View
          entering={SlideInUp.springify().damping(18).mass(0.8)}
          exiting={SlideOutDown.duration(250)}
          style={[styles.card, { backgroundColor: cardBg, borderColor }]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* أيقونة */}
          <View style={[styles.iconWrap, { backgroundColor: addAlpha(BRAND_BLUE, 0.12) }]}>
            {step === "success" ? (
              <Feather name="check-circle" size={28} color="#22C55E" />
            ) : (
              <Feather name="heart" size={28} color={BRAND_BLUE_DEEP} />
            )}
          </View>

          {/* العنوان */}
          <ThemedText type="h3" style={[styles.title, { color: textPrimary }]}>
            {step === "success" ? "تم الربط بنجاح!" : "ربط البيانات الصحية"}
          </ThemedText>

          {/* النص */}
          <ThemedText type="body" style={[styles.body, { color: textSecondary }]}>
            يساعد ترياق على قراءة مؤشراتك الصحية مثل النبض، النوم، والخطوات حتى يقدّم لك نصائح عامة وتنبيهات ذكية. هذه البيانات لا تُستخدم للتشخيص الطبي.
          </ThemedText>

          {/* صندوق الحالة */}
          <View style={[styles.noticeBox, { backgroundColor: notice.bg, borderColor: notice.border }]}>
            {isConnecting ? (
              <ActivityIndicator size="small" color={BRAND_BLUE} />
            ) : (
              <Feather name={notice.icon} size={14} color={notice.color} />
            )}
            <ThemedText
              type="caption"
              style={[styles.noticeText, { color: isDark ? addAlpha("#FFFFFF", 0.65) : "#374151" }]}
            >
              {notice.text}
            </ThemedText>
          </View>

          {/* زر الربط / إغلاق بعد النجاح */}
          {isDone ? (
            <Pressable
              style={[styles.btnPrimary, { backgroundColor: step === "success" ? "#22C55E" : BRAND_BLUE_DEEP }]}
              onPress={handleClose}
            >
              <Feather name={step === "success" ? "check" : "x"} size={16} color="#FFF" />
              <ThemedText type="small" style={styles.btnPrimaryText}>
                {step === "success" ? "رائع، إغلاق" : "إغلاق"}
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.btnPrimary,
                { backgroundColor: isConnecting ? addAlpha(BRAND_BLUE_DEEP, 0.6) : BRAND_BLUE_DEEP },
              ]}
              onPress={() => void handleConnect()}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Feather name="link" size={16} color="#FFF" />
              )}
              <ThemedText type="small" style={styles.btnPrimaryText}>
                {isConnecting ? "جارٍ الربط…" : "ربط البيانات الصحية"}
              </ThemedText>
            </Pressable>
          )}

          {/* زر إعدادات HC (يظهر عند الرفض) */}
          {step === "denied" && (
            <Pressable
              style={[styles.btnSecondary, { borderColor: addAlpha("#F97316", 0.4) }]}
              onPress={() => void handleOpenHCSettings()}
            >
              <ThemedText type="small" style={[styles.btnSecondaryText, { color: "#F97316" }]}>
                فتح إعدادات Health Connect
              </ThemedText>
            </Pressable>
          )}

          {/* زر إدارة / إلغاء */}
          {!isDone && (
            <Pressable style={styles.btnSecondary} onPress={handleManage}>
              <ThemedText type="small" style={[styles.btnSecondaryText, { color: BRAND_BLUE }]}>
                إدارة الصلاحيات
              </ThemedText>
            </Pressable>
          )}

          <Pressable style={styles.btnGhost} onPress={handleClose}>
            <ThemedText type="caption" style={{ color: textSecondary }}>
              {isDone ? null : "ليس الآن"}
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
    borderColor: addAlpha("#2A4FCC", 0.3),
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
    minHeight: 20,
  },
});
