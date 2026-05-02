import { Platform } from "react-native";

export const Colors = {
  light: {
    primary: "#5EDFFF",
    primaryDark: "#1F6AE1",
    accent: "#1F6AE1",
    text: "#1A1D23",
    textSecondary: "#6B7A8C",
    buttonText: "#FFFFFF",
    tabIconDefault: "#A0B0C0",
    tabIconSelected: "#5EDFFF",
    link: "#1F6AE1",
    backgroundRoot: "#F2F2F7",
    backgroundDefault: "#F2F2F7",
    backgroundSecondary: "#F5F9FC",
    backgroundTertiary: "#EBF3FA",
    border: "#E5EEF5",
    success: "#4CD964",
    warning: "#FFCC00",
    error: "#FF6B6B",
    info: "#5EDFFF",
    overlay: "rgba(31,106,225,0.15)",
    gradient: {
      start: "#5EDFFF",
      end: "#1F6AE1",
    },
    card: "#FFFFFF",
    cardShadow: "rgba(94,223,255,0.25)",
    bannerBackground: "#D6D6D6",
  },
  dark: {
    primary: "#5EDFFF",
    primaryDark: "#1F6AE1",
    accent: "#5EDFFF",
    text: "#F8F9FA",
    textSecondary: "#ADB5BD",
    buttonText: "#1A1D23",
    tabIconDefault: "#6C757D",
    tabIconSelected: "#5EDFFF",
    link: "#5EDFFF",
    backgroundRoot: "#0D1117",
    backgroundDefault: "#161B22",
    backgroundSecondary: "#21262D",
    backgroundTertiary: "#30363D",
    border: "#30363D",
    success: "#4CD964",
    warning: "#FFCC00",
    error: "#FF6B6B",
    info: "#5EDFFF",
    overlay: "rgba(94,223,255,0.15)",
    gradient: {
      start: "#1F6AE1",
      end: "#5EDFFF",
    },
    card: "#161B22",
    cardShadow: "rgba(94,223,255,0.15)",
    bannerBackground: "#1A2332",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 52,
  buttonHeight: 56,
  headerHeight: 64,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  hero: { fontSize: 36, lineHeight: 44, fontWeight: "700" as const },
  h1: { fontSize: 30, lineHeight: 38, fontWeight: "700" as const },
  h2: { fontSize: 26, lineHeight: 34, fontWeight: "600" as const },
  h3: { fontSize: 22, lineHeight: 30, fontWeight: "600" as const },
  h4: { fontSize: 18, lineHeight: 26, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  small: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  link: { fontSize: 16, lineHeight: 24, fontWeight: "500" as const },
};

export const Shadows = {
  small: {
    shadowColor: "#5EDFFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: "#5EDFFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: "#5EDFFF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: "#5EDFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
};

export const Animation = {
  duration: { fast: 150, normal: 250, slow: 400, slower: 600 },
  spring: {
    gentle: { damping: 20, stiffness: 120, mass: 0.8 },
    bouncy: { damping: 12, stiffness: 180, mass: 0.5 },
    snappy: { damping: 25, stiffness: 300, mass: 0.4 },
  },
  stagger: { fast: 50, normal: 80, slow: 120 },
};

export function addAlpha(color: string, opacity: number): string {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return color;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const a = Math.round(opacity * 100) / 100;
  return `rgba(${r},${g},${b},${a})`;
}

const colors = {
  light: Colors.light,
  dark: Colors.dark,
  radius: 16,
};

export default colors;
