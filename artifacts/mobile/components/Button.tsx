import React, { type ReactNode } from "react";
import { StyleSheet, Pressable, type ViewStyle, type StyleProp, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Animation, addAlpha } from "@/constants/colors";

interface ButtonProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline";
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ onPress, children, style, disabled = false, variant = "primary" }: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) scale.value = withSpring(0.97, Animation.spring.snappy);
  };
  const handlePressOut = () => {
    if (!disabled) scale.value = withSpring(1, Animation.spring.gentle);
  };
  const handlePress = () => {
    if (!disabled && onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const shadowStyle = Platform.select({
    ios: { shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    android: { elevation: 4 },
    default: {},
  });

  if (variant === "primary") {
    return (
      <AnimatedPressable
        android_ripple={{ color: "transparent" }}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[styles.button, { opacity: disabled ? 0.5 : 1 }, shadowStyle, style, animatedStyle]}
      >
        <LinearGradient
          colors={[theme.primary, theme.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <ThemedText type="body" style={[styles.buttonText, { color: theme.buttonText }]}>
            {children}
          </ThemedText>
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  if (variant === "secondary") {
    return (
      <AnimatedPressable
        android_ripple={{ color: "transparent" }}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[styles.button, { backgroundColor: theme.backgroundSecondary, opacity: disabled ? 0.5 : 1 }, style, animatedStyle]}
      >
        <ThemedText type="body" style={[styles.buttonText, { color: theme.text }]}>
          {children}
        </ThemedText>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      android_ripple={{ color: "transparent" }}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[styles.button, styles.outline, { borderColor: theme.primary, opacity: disabled ? 0.5 : 1 }, style, animatedStyle]}
    >
      <ThemedText type="body" style={[styles.buttonText, { color: theme.primary }]}>
        {children}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  gradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  buttonText: {
    fontWeight: "600",
    textAlign: "center",
  },
  outline: {
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
});
