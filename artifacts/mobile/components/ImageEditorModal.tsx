import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import * as ImageManipulator from "expo-image-manipulator";
import { ThemedText } from "@/components/ThemedText";

interface Props {
  visible: boolean;
  uri: string | null;
  onCancel: () => void;
  onDone: (uri: string) => void;
}

const FRAME_SIZE = Math.min(Dimensions.get("window").width - 40, 320);
const MIN_SCALE = 1;
const MAX_SCALE = 4;

export default function ImageEditorModal({ visible, uri, onCancel, onDone }: Props) {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [rotation, setRotation] = useState(0);
  const [processing, setProcessing] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);

  useEffect(() => {
    if (!uri) {
      setImgSize(null);
      return;
    }
    Image.getSize(
      uri,
      (w, h) => setImgSize({ w, h }),
      () => setImgSize({ w: 1000, h: 1000 }),
    );
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
    setRotation(0);
  }, [uri]);

  const fittedSize = (() => {
    if (!imgSize) return { w: FRAME_SIZE, h: FRAME_SIZE };
    const isRotated = rotation % 180 !== 0;
    const w = isRotated ? imgSize.h : imgSize.w;
    const h = isRotated ? imgSize.w : imgSize.h;
    const ratio = w / h;
    if (ratio >= 1) {
      return { w: FRAME_SIZE * ratio, h: FRAME_SIZE };
    }
    return { w: FRAME_SIZE, h: FRAME_SIZE / ratio };
  })();

  const clamp = (val: number, min: number, max: number) =>
    Math.min(Math.max(val, min), max);

  const clampOffsets = () => {
    "worklet";
    const scaledW = fittedSize.w * scale.value;
    const scaledH = fittedSize.h * scale.value;
    const maxX = Math.max(0, (scaledW - FRAME_SIZE) / 2);
    const maxY = Math.max(0, (scaledH - FRAME_SIZE) / 2);
    translateX.value = withSpring(clamp(translateX.value, -maxX, maxX), { damping: 18 });
    translateY.value = withSpring(clamp(translateY.value, -maxY, maxY), { damping: 18 });
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      clampOffsets();
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = startScale.value * e.scale;
      scale.value = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      clampOffsets();
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleRotate = () => {
    const next = (rotation + 90) % 360;
    setRotation(next);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    scale.value = withSpring(1);
  };

  const handleReset = () => {
    setRotation(0);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    scale.value = withSpring(1);
  };

  const handleZoomIn = () => {
    scale.value = withSpring(Math.min(scale.value + 0.5, MAX_SCALE));
  };

  const handleZoomOut = () => {
    scale.value = withSpring(Math.max(scale.value - 0.5, MIN_SCALE));
    clampOffsets();
  };

  const finishWithUri = (newUri: string) => {
    setProcessing(false);
    onDone(newUri);
  };

  const handleConfirm = async () => {
    if (!uri || !imgSize) return;
    setProcessing(true);
    try {
      const actions: ImageManipulator.Action[] = [];
      if (rotation !== 0) {
        actions.push({ rotate: rotation });
      }

      const isRotated = rotation % 180 !== 0;
      const srcW = isRotated ? imgSize.h : imgSize.w;
      const srcH = isRotated ? imgSize.w : imgSize.h;

      const displayW = fittedSize.w * scale.value;
      const displayH = fittedSize.h * scale.value;
      const pxPerUnitX = srcW / displayW;
      const pxPerUnitY = srcH / displayH;

      const visibleLeft =
        (displayW - FRAME_SIZE) / 2 - translateX.value;
      const visibleTop =
        (displayH - FRAME_SIZE) / 2 - translateY.value;

      const cropX = clamp(visibleLeft * pxPerUnitX, 0, srcW - 1);
      const cropY = clamp(visibleTop * pxPerUnitY, 0, srcH - 1);
      const cropW = clamp(FRAME_SIZE * pxPerUnitX, 1, srcW - cropX);
      const cropH = clamp(FRAME_SIZE * pxPerUnitY, 1, srcH - cropY);

      actions.push({
        crop: {
          originX: Math.round(cropX),
          originY: Math.round(cropY),
          width: Math.round(cropW),
          height: Math.round(cropH),
        },
      });

      const result = await ImageManipulator.manipulateAsync(uri, actions, {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      finishWithUri(result.uri);
    } catch (e) {
      setProcessing(false);
      Alert.alert("خطأ", "تعذّر معالجة الصورة");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={10} style={styles.headerBtn}>
            <Feather name="x" size={24} color="#FFF" />
          </Pressable>
          <ThemedText type="h3" style={styles.title}>
            تعديل الصورة
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.frameWrap}>
          <View style={styles.frame}>
            {uri ? (
              <GestureDetector gesture={composed}>
                <Animated.View style={[styles.imgContainer, animatedStyle]}>
                  <Image
                    source={{ uri }}
                    style={{
                      width: fittedSize.w,
                      height: fittedSize.h,
                      transform: [{ rotate: `${rotation}deg` }],
                    }}
                    resizeMode="contain"
                  />
                </Animated.View>
              </GestureDetector>
            ) : null}
            <View pointerEvents="none" style={styles.frameOverlay}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
            </View>
          </View>
          <ThemedText type="caption" style={styles.hint}>
            اسحب لتحريك الصورة • قرّب لتكبير
          </ThemedText>
        </View>

        <View style={styles.toolbar}>
          <ToolBtn icon="zoom-out" label="تصغير" onPress={handleZoomOut} />
          <ToolBtn icon="zoom-in" label="تكبير" onPress={handleZoomIn} />
          <ToolBtn icon="rotate-cw" label="تدوير" onPress={handleRotate} />
          <ToolBtn icon="refresh-ccw" label="إعادة" onPress={handleReset} />
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={onCancel}
            style={[styles.actionBtn, styles.cancelBtn]}
          >
            <ThemedText type="body" style={styles.cancelText}>
              إلغاء
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={processing}
            style={[styles.actionBtn, styles.confirmBtn, processing && { opacity: 0.7 }]}
          >
            {processing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Feather name="check" size={18} color="#FFF" />
                <ThemedText type="body" style={styles.confirmText}>
                  استخدام الصورة
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ToolBtn({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.toolBtn}>
      <Feather name={icon as never} size={20} color="#FFF" />
      <ThemedText type="caption" style={styles.toolLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(8,12,20,0.96)",
    paddingTop: 60,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  headerBtn: { padding: 4 },
  title: { color: "#FFF", fontWeight: "800", fontSize: 17 },
  frameWrap: { alignItems: "center", flex: 1, justifyContent: "center" },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: FRAME_SIZE / 2,
    overflow: "hidden",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  imgContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: FRAME_SIZE / 2,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.95)",
  },
  cornerTL: {
    position: "absolute", top: 12, left: 12, width: 22, height: 22,
    borderTopWidth: 3, borderLeftWidth: 3, borderColor: "#5CC4E6",
  },
  cornerTR: {
    position: "absolute", top: 12, right: 12, width: 22, height: 22,
    borderTopWidth: 3, borderRightWidth: 3, borderColor: "#5CC4E6",
  },
  cornerBL: {
    position: "absolute", bottom: 12, left: 12, width: 22, height: 22,
    borderBottomWidth: 3, borderLeftWidth: 3, borderColor: "#5CC4E6",
  },
  cornerBR: {
    position: "absolute", bottom: 12, right: 12, width: 22, height: 22,
    borderBottomWidth: 3, borderRightWidth: 3, borderColor: "#5CC4E6",
  },
  hint: {
    color: "rgba(255,255,255,0.7)",
    marginTop: 16,
    fontSize: 12,
    textAlign: "center",
  },
  toolbar: {
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 24,
    borderRadius: 18,
    marginBottom: 16,
  },
  toolBtn: { alignItems: "center", gap: 4, paddingHorizontal: 6 },
  toolLabel: { color: "#FFF", fontSize: 11 },
  actionRow: {
    flexDirection: "row-reverse",
    paddingHorizontal: 24,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  cancelBtn: { backgroundColor: "rgba(255,255,255,0.12)" },
  cancelText: { color: "#FFF", fontWeight: "700" },
  confirmBtn: { backgroundColor: "#2A4FCC" },
  confirmText: { color: "#FFF", fontWeight: "800" },
});
