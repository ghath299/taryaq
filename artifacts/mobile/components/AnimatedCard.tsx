import React, { useEffect } from "react";
import { StyleSheet, Pressable, type ViewStyle, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  FadeInDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Animation } from "@/constants/colors";

interface AnimatedCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  index?: number;
  variant?: "default" | "gradient" | "glass";
  disabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AnimatedCard({ children, onPress, style, index = 0, variant = "default", disabled = false }: AnimatedCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const elevation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: interpolate(elevation.value, [0, 1], [0, -4], Extrapolation.CLAMP) },
    ],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.97, Animation.spring.snappy);
      elevation.value = withTiming(0, { duration: Animation.duration.fast });
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, Animation.spring.gentle);
      elevation.value = withTiming(1, { duration: Animation.duration.normal });
    }
  };

  useEffect(() => {
    elevation.value = withTiming(1, { duration: Animation.duration.slow });
  }, []);

  const shadowStyle = Platform.select({
    ios: { shadowColor: theme.cardShadow || "#5EDFFF", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12 },
    android: { elevation: 6 },
    default: {},
  });

  if (variant === "gradient") {
    return (
      <AnimatedPressable
        android_ripple={{ color: "transparent" }}
        onPress={disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        entering={FadeInDown.delay(index * Animation.stagger.normal).duration(Animation.duration.slow)}
        style={[styles.card, shadowStyle, animatedStyle, style]}
      >
        <LinearGradient
          colors={[theme.gradient?.start || "#5EDFFF", theme.gradient?.end || "#1F6AE1"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBg}
        >
          {children}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      android_ripple={{ color: "transparent" }}
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      entering={FadeInDown.delay(index * Animation.stagger.normal).duration(Animation.duration.slow)}
      style={[styles.card, { backgroundColor: theme.card || theme.backgroundDefault }, shadowStyle, animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.xl, overflow: "hidden" },
  gradientBg: { padding: 20, borderRadius: BorderRadius.xl },
});
