import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import { ThemedText } from "./ThemedText";

const GRADIENT_PAIRS: [string, string][] = [
  ["#1F40C8", "#5CC4E6"],
  ["#7C3AED", "#A78BFA"],
  ["#0E9488", "#5EEAD4"],
  ["#F97316", "#FCD34D"],
  ["#EF4444", "#F9A8D4"],
  ["#059669", "#6EE7B7"],
];

function pickColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const pair = GRADIENT_PAIRS[Math.abs(hash) % GRADIENT_PAIRS.length];
  return pair[0];
}

interface Props {
  name: string;
  size?: number;
  style?: ViewStyle;
  textColor?: string;
}

export default function InitialsAvatar({
  name,
  size = 48,
  style,
  textColor = "#FFFFFF",
}: Props) {
  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "؟";
  const bgColor = pickColor(name ?? "");
  const fontSize = Math.round(size * 0.42);

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
        style,
      ]}
    >
      <ThemedText
        style={[styles.text, { fontSize, color: textColor, lineHeight: size }]}
      >
        {initial}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  text: {
    fontWeight: "800",
    textAlign: "center",
    includeFontPadding: false,
  },
});
