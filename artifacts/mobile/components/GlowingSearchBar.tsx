import React, { useState } from "react";
import { View, TextInput, StyleSheet, Platform } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/contexts/AppContext";
import { Spacing, BorderRadius, Animation, addAlpha } from "@/constants/colors";

interface GlowingSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function GlowingSearchBar({ value, onChangeText, placeholder, autoFocus }: GlowingSearchBarProps) {
  const { theme, isDark } = useTheme();
  const { t } = useApp();
  const [isFocused, setIsFocused] = useState(false);
  const glowOpacity = useSharedValue(0);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handleFocus = () => {
    setIsFocused(true);
    glowOpacity.value = withSpring(1, Animation.spring.gentle);
  };

  const handleBlur = () => {
    setIsFocused(false);
    glowOpacity.value = withSpring(0, Animation.spring.gentle);
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.glow, { backgroundColor: addAlpha(theme.primary, 0.15) }, glowStyle]} />
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: isDark ? theme.card : "#FFFFFF",
            borderColor: isFocused ? theme.primary : theme.border,
            borderWidth: isFocused ? 1.5 : 1,
          },
        ]}
      >
        {isFocused ? (
          <LinearGradient
            colors={[theme.primary, theme.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.iconGradient}
          >
            <Feather name="search" size={16} color="#FFF" />
          </LinearGradient>
        ) : (
          <View style={[styles.iconPlain, { backgroundColor: addAlpha(theme.primary, 0.08) }]}>
            <Feather name="search" size={16} color={theme.primary} />
          </View>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || t("search")}
          placeholderTextColor={theme.textSecondary}
          autoFocus={autoFocus}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[
            styles.input,
            {
              color: theme.text,
              fontFamily: "Tajawal_400Regular",
            },
          ]}
          textAlign="right"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative" },
  glow: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: BorderRadius.md + 4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: Spacing.inputHeight,
    gap: Spacing.sm,
  },
  iconGradient: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPlain: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
});
