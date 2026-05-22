import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useRef, useEffect } from "react";
import {
  Platform,
  StyleSheet,
  View,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

// ─── الترتيب: الأطباء | الرئيسية (FAB) | علاج وصيدلية ───────────────────────
const TABS = [
  { routeIndex: 1, name: "doctors", label: "الأطباء", icon: "user" as const },
  {
    routeIndex: 0,
    name: "index",
    label: "الرئيسية",
    icon: "home" as const,
    fab: true,
  },
  {
    routeIndex: 2,
    name: "medicines",
    label: "علاج وصيدلية",
    icon: "package" as const,
  },
];

// ─── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme, isDark } = useTheme();
  const isIOS = Platform.OS === "ios";

  // قيمة Animated لكل تاب (0 = غير نشط، 1 = نشط)
  const anims = useRef(
    [0, 1, 2].map((i) => new Animated.Value(state.index === i ? 1 : 0)),
  ).current;

  useEffect(() => {
    anims.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: state.index === i ? 1 : 0,
        useNativeDriver: false,
        tension: 120,
        friction: 10,
      }).start();
    });
  }, [state.index]);

  const navigateTo = (routeIndex: number) => {
    const route = state.routes[routeIndex];
    const isFocused = state.index === routeIndex;
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const barBg = isIOS ? "transparent" : isDark ? theme.card : "#FFFFFF";

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: barBg, borderTopColor: theme.border },
      ]}
    >
      {/* iOS blur */}
      {isIOS && (
        <BlurView
          intensity={90}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={styles.row}>
        {TABS.map((tab) => {
          const anim = anims[tab.routeIndex];
          const active = state.index === tab.routeIndex;

          // ── FAB (الرئيسية) ────────────────────────────────────────────────
          if (tab.fab) {
            const fabWidth = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [52, 126],
            });
            const textOpacity = anim.interpolate({
              inputRange: [0, 0.55, 1],
              outputRange: [0, 0, 1],
            });
            const textWidth = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 62],
            });

            return (
              <View key={tab.name} style={styles.fabWrap}>
                <TouchableOpacity
                  onPress={() => navigateTo(tab.routeIndex)}
                  activeOpacity={0.82}
                >
                  <Animated.View
                    style={[
                      styles.fab,
                      { width: fabWidth, backgroundColor: theme.primary },
                    ]}
                  >
                    <Feather name={tab.icon} size={22} color="#fff" />
                    {/* النص يظهر عند التمدد */}
                    <Animated.View
                      style={{ overflow: "hidden", width: textWidth }}
                    >
                      <Animated.Text
                        style={[styles.fabLabel, { opacity: textOpacity }]}
                        numberOfLines={1}
                      >
                        {"  "}
                        {tab.label}
                      </Animated.Text>
                    </Animated.View>
                  </Animated.View>
                </TouchableOpacity>
              </View>
            );
          }

          // ── Pill item عادي ────────────────────────────────────────────────
          const pillBg = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [
              "rgba(0,0,0,0)",
              isDark ? "rgba(45,42,74,1)" : "rgba(237,233,254,1)",
            ],
          });
          const textOpacity = anim.interpolate({
            inputRange: [0, 0.55, 1],
            outputRange: [0, 0, 1],
          });
          const textWidth = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 82],
          });

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => navigateTo(tab.routeIndex)}
              activeOpacity={0.7}
            >
              <Animated.View style={[styles.pill, { backgroundColor: pillBg }]}>
                <Feather
                  name={tab.icon}
                  size={21}
                  color={active ? theme.primary : theme.tabIconDefault}
                />
                <Animated.View style={{ overflow: "hidden", width: textWidth }}>
                  <Animated.Text
                    style={[
                      styles.pillLabel,
                      { opacity: textOpacity, color: theme.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {"  "}
                    {tab.label}
                  </Animated.Text>
                </Animated.View>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 0.5,
    // safe area للأجهزة التي تحتاج padding سفلي
    paddingBottom: Platform.select({ ios: 24, android: 10, default: 12 }),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingHorizontal: 12,
  },

  // FAB ──────────────────────────────────────────────────────────────────────
  fabWrap: {
    alignItems: "center",
    marginTop: -18, // يرتفع فوق الشريط قليلاً
  },
  fab: {
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    overflow: "hidden",
  },
  fabLabel: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Cairo-Regular",
    fontWeight: "600",
  },

  // Pill ─────────────────────────────────────────────────────────────────────
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  pillLabel: {
    fontSize: 11,
    fontFamily: "Cairo-Regular",
    fontWeight: "500",
  },
});

// ─── Layout الرئيسي ────────────────────────────────────────────────────────────
export default function TabLayout() {
  const { theme, isDark } = useTheme();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: isIOS
            ? "transparent"
            : isDark
              ? theme.backgroundDefault
              : theme.backgroundRoot,
        },
        headerStatusBarHeight: isWeb ? 50 : undefined,
        headerTransparent: isIOS,
        headerTintColor: theme.text,
        headerTitleStyle: {
          fontFamily: "Cairo-Regular",
          fontSize: 18,
        },
      }}
    >
      {/* index = 0 */}
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          headerShown: false,
        }}
      />

      {/* index = 1 */}
      <Tabs.Screen
        name="doctors"
        options={{
          title: "الأطباء",
          headerTitle: "الأطباء",
          headerTitleAlign: "center",
        }}
      />

      {/* index = 2 */}
      <Tabs.Screen
        name="medicines"
        options={{
          title: "العلاجات والصيدليات",
          headerShown: false,
        }}
      />

      {/* مخفي - لا يظهر بالشريط */}
      <Tabs.Screen
        name="medicine-search"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
