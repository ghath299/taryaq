import { BlurView } from "expo-blur";
import { Tabs, router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useRef, useEffect } from "react";
import { Platform, StyleSheet, View, Pressable, Animated } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

// الترتيب بالشريط: الأطباء | الرئيسية (FAB) | علاج وصيدلية
const TABS = [
  {
    name: "doctors",
    label: "الأطباء",
    iconSet: "mci" as const,
    icon: "stethoscope",
  },
  {
    name: "index",
    label: "الرئيسية",
    iconSet: "fi" as const,
    icon: "home",
    fab: true,
  },
  {
    name: "medicines",
    label: "علاج وصيدلية",
    iconSet: "mci" as const,
    icon: "pill",
  },
];

// مكوّن الأيقونة — يختار بين Feather و MaterialCommunityIcons
function TabIcon({
  iconSet,
  icon,
  size,
  color,
}: {
  iconSet: "fi" | "mci";
  icon: string;
  size: number;
  color: string;
}) {
  if (iconSet === "mci") {
    return (
      <MaterialCommunityIcons name={icon as any} size={size} color={color} />
    );
  }
  return <Feather name={icon as any} size={size} color={color} />;
}

function CustomTabBar({ state }: BottomTabBarProps) {
  const { theme, isDark } = useTheme();
  const isIOS = Platform.OS === "ios";

  const getIdx = (name: string) =>
    state.routes.findIndex((r) => r.name === name);

  const animMap = useRef<Record<string, Animated.Value>>({});
  TABS.forEach((tab) => {
    if (!animMap.current[tab.name]) {
      const idx = getIdx(tab.name);
      animMap.current[tab.name] = new Animated.Value(
        idx === state.index ? 1 : 0,
      );
    }
  });

  useEffect(() => {
    TABS.forEach((tab) => {
      const idx = getIdx(tab.name);
      Animated.spring(animMap.current[tab.name], {
        toValue: idx === state.index ? 1 : 0,
        useNativeDriver: false,
        tension: 120,
        friction: 10,
      }).start();
    });
  }, [state.index]);

  const barBg = isIOS ? "transparent" : isDark ? theme.card : "#FFFFFF";

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: barBg, borderTopColor: theme.border },
      ]}
    >
      {isIOS && (
        <BlurView
          intensity={90}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={styles.row}>
        {TABS.map((tab) => {
          const idx = getIdx(tab.name);
          const active = idx === state.index;
          const anim = animMap.current[tab.name];

          // ── FAB (الرئيسية) ────────────────────────────────────────────────
          if (tab.fab) {
            const fabWidth = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [52, 130],
            });
            const textOpacity = anim.interpolate({
              inputRange: [0, 0.6, 1],
              outputRange: [0, 0, 1],
            });
            const textWidth = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 66],
            });

            return (
              <View key={tab.name} style={styles.fabWrap}>
                <Pressable
                  onPress={() => router.navigate(tab.name as any)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                >
                  <Animated.View
                    style={[
                      styles.fab,
                      { width: fabWidth, backgroundColor: theme.primary },
                    ]}
                  >
                    <TabIcon
                      iconSet={tab.iconSet}
                      icon={tab.icon}
                      size={22}
                      color="#fff"
                    />
                    <View style={{ overflow: "hidden" }}>
                      <Animated.View style={{ width: textWidth }}>
                        <Animated.Text
                          style={[styles.fabLabel, { opacity: textOpacity }]}
                          numberOfLines={1}
                        >
                          {tab.label}
                        </Animated.Text>
                      </Animated.View>
                    </View>
                  </Animated.View>
                </Pressable>
              </View>
            );
          }

          // ── Pill عادي ─────────────────────────────────────────────────────
          const pillBg = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [
              "rgba(0,0,0,0)",
              isDark ? "rgba(45,42,74,1)" : "rgba(237,233,254,1)",
            ],
          });
          const textOpacity = anim.interpolate({
            inputRange: [0, 0.6, 1],
            outputRange: [0, 0, 1],
          });
          const textWidth = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 78],
          });

          return (
            <Pressable
              key={tab.name}
              onPress={() => router.navigate(tab.name as any)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Animated.View style={[styles.pill, { backgroundColor: pillBg }]}>
                <TabIcon
                  iconSet={tab.iconSet}
                  icon={tab.icon}
                  size={21}
                  color={active ? theme.primary : theme.tabIconDefault}
                />
                {/* overflow منفصل حتى ما يمنع اللمس */}
                <View style={{ overflow: "hidden" }}>
                  <Animated.View style={{ width: textWidth }}>
                    <Animated.Text
                      style={[
                        styles.pillLabel,
                        { opacity: textOpacity, color: theme.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {tab.label}
                    </Animated.Text>
                  </Animated.View>
                </View>
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 0.5,
    paddingBottom: Platform.select({ ios: 24, android: 10, default: 12 }),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingHorizontal: 12,
  },

  // FAB
  fabWrap: {
    alignItems: "center",
    marginTop: -18,
  },
  fab: {
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7, // ← المسافة بين الأيقونة والنص
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  fabLabel: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Cairo-Regular",
    fontWeight: "600",
  },

  // Pill
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6, // ← المسافة بين الأيقونة والنص
  },
  pillLabel: {
    fontSize: 11,
    fontFamily: "Cairo-Regular",
    fontWeight: "500",
  },
});

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
      <Tabs.Screen
        name="index"
        options={{ title: "الرئيسية", headerShown: false }}
      />
      <Tabs.Screen
        name="doctors"
        options={{
          title: "الأطباء",
          headerTitle: "الأطباء",
          headerTitleAlign: "center",
        }}
      />
      <Tabs.Screen
        name="medicines"
        options={{ title: "العلاجات والصيدليات", headerShown: false }}
      />
      <Tabs.Screen
        name="medicine-search"
        options={{ href: null, headerShown: false }}
      />
    </Tabs>
  );
}
