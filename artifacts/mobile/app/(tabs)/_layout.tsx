import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useRef, useEffect } from "react";
import { Platform, StyleSheet, View, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

// ─── تعريف التابس ─────────────────────────────────────────────────────────────
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

// ─── مكوّن الأيقونة ────────────────────────────────────────────────────────────
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
  if (iconSet === "mci")
    return (
      <MaterialCommunityIcons name={icon as any} size={size} color={color} />
    );
  return <Feather name={icon as any} size={size} color={color} />;
}

// ─── Pill Item (الأطباء / علاج وصيدلية) ──────────────────────────────────────
function PillTab({ tab, active, onPress, theme, isDark }: any) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, {
      mass: 0.5,
      damping: 12,
      stiffness: 180,
    });
  }, [active]);

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: isDark
      ? `rgba(45,42,74,${progress.value})`
      : `rgba(237,233,254,${progress.value})`,
    paddingHorizontal: interpolate(progress.value, [0, 1], [12, 14]),
  }));

  const textStyle = useAnimatedStyle(() => ({
    maxWidth: interpolate(progress.value, [0, 1], [0, 82]),
    opacity: interpolate(progress.value, [0, 0.6, 1], [0, 0, 1]),
  }));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
    >
      <Animated.View style={[styles.pill, pillStyle]}>
        <TabIcon
          iconSet={tab.iconSet}
          icon={tab.icon}
          size={21}
          color={active ? theme.primary : theme.tabIconDefault}
        />
        <Animated.View style={[{ overflow: "hidden" }, textStyle]}>
          <Animated.Text
            style={[styles.pillLabel, { color: theme.primary }]}
            numberOfLines={1}
          >
            {tab.label}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

// ─── FAB (الرئيسية) ────────────────────────────────────────────────────────────
function FabTab({ tab, active, onPress, theme }: any) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, {
      mass: 0.5,
      damping: 12,
      stiffness: 180,
    });
  }, [active]);

  const fabStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [54, 132]),
  }));

  const textStyle = useAnimatedStyle(() => ({
    maxWidth: interpolate(progress.value, [0, 1], [0, 68]),
    opacity: interpolate(progress.value, [0, 0.6, 1], [0, 0, 1]),
  }));

  return (
    <View style={styles.fabWrap}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Animated.View
          style={[styles.fab, fabStyle, { backgroundColor: theme.primary }]}
        >
          <TabIcon
            iconSet={tab.iconSet}
            icon={tab.icon}
            size={23}
            color="#fff"
          />
          <Animated.View style={[{ overflow: "hidden" }, textStyle]}>
            <Animated.Text style={styles.fabLabel} numberOfLines={1}>
              {tab.label}
            </Animated.Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

// ─── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme, isDark } = useTheme();
  const isIOS = Platform.OS === "ios";

  const getIdx = (name: string) =>
    state.routes.findIndex((r) => r.name === name);

  const navigateTo = (tabName: string) => {
    const route = state.routes.find((r) => r.name === tabName);
    if (!route) return;
    const isFocused = state.routes[state.index]?.name === tabName;
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(tabName, undefined);
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
      {isIOS && (
        <BlurView
          intensity={90}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.row}>
        {TABS.map((tab) => {
          const active = getIdx(tab.name) === state.index;
          if (tab.fab) {
            return (
              <FabTab
                key={tab.name}
                tab={tab}
                active={active}
                onPress={() => navigateTo(tab.name)}
                theme={theme}
              />
            );
          }
          return (
            <PillTab
              key={tab.name}
              tab={tab}
              active={active}
              onPress={() => navigateTo(tab.name)}
              theme={theme}
              isDark={isDark}
            />
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
    paddingBottom: Platform.select({ ios: 24, android: 10, default: 12 }),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  fabWrap: {
    alignItems: "center",
    marginTop: -20,
  },
  fab: {
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  fabLabel: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Cairo-Regular",
    fontWeight: "600",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    paddingVertical: 8,
    gap: 6,
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
        headerTitleStyle: { fontFamily: "Cairo-Regular", fontSize: 18 },
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
