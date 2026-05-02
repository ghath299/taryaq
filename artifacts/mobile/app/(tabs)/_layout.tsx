import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { HeaderTitle } from "@/components/HeaderTitle";

export default function TabLayout() {
  const { theme, isDark } = useTheme();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        headerShown: true,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : (isDark ? theme.card : "#FFFFFF"),
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: theme.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? theme.card : "#FFFFFF" }]} />
          ) : null,
        tabBarLabelStyle: {
          fontFamily: "Tajawal_500Medium",
          fontSize: 11,
        },
        headerStyle: {
          backgroundColor: isIOS ? "transparent" : (isDark ? theme.backgroundDefault : theme.backgroundRoot),
        },
        headerTransparent: isIOS,
        headerBlurEffect: isDark ? "dark" : "light",
        headerTintColor: theme.text,
        headerTitleStyle: {
          fontFamily: "Tajawal_700Bold",
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          headerTitle: () => <HeaderTitle title="ترياق" />,
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="doctors"
        options={{
          title: "الأطباء",
          headerTitle: "الأطباء",
          headerTitleAlign: "right",
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="medicines"
        options={{
          title: "العلاجات",
          headerTitle: "العلاجات",
          headerTitleAlign: "right",
          tabBarIcon: ({ color }) => <Feather name="package" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pharmacies"
        options={{
          title: "الصيدليات",
          headerTitle: "الصيدليات",
          headerTitleAlign: "right",
          tabBarIcon: ({ color }) => <Feather name="cross" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
