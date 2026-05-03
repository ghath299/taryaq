if (typeof window !== "undefined") {
  const originalError = window.onerror;
  window.onerror = (msg, ...rest) => {
    if (String(msg).includes("timeout exceeded")) return true;
    return (originalError as ((m: unknown, ...r: unknown[]) => boolean) | null)?.(msg, ...rest) ?? false;
  };
  window.addEventListener(
    "unhandledrejection",
    (e) => {
      if (String((e as PromiseRejectionEvent).reason).includes("timeout exceeded")) e.preventDefault();
    },
    true,
  );
}

import { useFonts } from "expo-font";
import { Asset } from "expo-asset";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { useNotificationSetup } from "@/hooks/useNotifications";

SplashScreen.preventAutoHideAsync().catch(() => {});

setBaseUrl(`https://${process.env["EXPO_PUBLIC_DOMAIN"]}`);

if (Platform.OS === "web" && typeof document !== "undefined") {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap&subset=arabic";
  document.head.appendChild(link);
  const style = document.createElement("style");
  style.textContent = `* { font-family: 'Cairo', system-ui, sans-serif !important; }`;
  document.head.appendChild(style);
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  useNotificationSetup();

  return (
    <Stack screenOptions={{ headerShown: false, headerStatusBarHeight: Platform.OS === "web" ? 50 : undefined }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="doctor/[id]"
        options={{
          headerShown: true,
          headerTitle: "تفاصيل الطبيب",
          headerBackTitle: "رجوع",
          headerTitleAlign: "center",
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="book/[doctorId]"
        options={{
          headerShown: true,
          headerTitle: "حجز موعد",
          headerTitleAlign: "center",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="bookings"
        options={{
          headerShown: true,
          headerTitle: "حجوزاتي",
          headerTitleAlign: "center",
          headerBackTitle: "رجوع",
        }}
      />
      <Stack.Screen
        name="orders"
        options={{
          headerShown: true,
          headerTitle: "طلباتي",
          headerTitleAlign: "center",
          headerBackTitle: "رجوع",
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: true,
          headerTitle: "الإشعارات",
          headerTitleAlign: "center",
          headerBackTitle: "رجوع",
        }}
      />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen
        name="profile"
        options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="career-join"
        options={{
          headerShown: true,
          headerTitle: "انضم إلينا",
          headerTitleAlign: "center",
          headerBackTitle: "رجوع",
        }}
      />
    </Stack>
  );
}

const IMAGES_TO_PRELOAD = [
  require("../assets/images/doctor-consultation-light.jpeg"),
  require("../assets/images/doctor-consultation-dark.jpeg"),
  require("../assets/images/doctor-ahmed.png"),
  require("../assets/images/doctor-sara.png"),
  require("../assets/images/doctor-ali.png"),
  require("../assets/images/banner-phone.png"),
  require("../assets/images/water-glass.png"),
  require("../assets/images/health-shield.png"),
  require("../assets/images/user-avatar.png"),
  require("../assets/images/doctor-consultation.png"),
];

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  const [fontsLoaded] = useFonts(
    Platform.OS === "web"
      ? {}
      : {
          "Cairo-Regular": require("../assets/fonts/Cairo-Regular.ttf"),
          "Cairo-Medium": require("../assets/fonts/Cairo-Medium.ttf"),
          "Cairo-SemiBold": require("../assets/fonts/Cairo-SemiBold.ttf"),
          "Cairo-Bold": require("../assets/fonts/Cairo-Bold.ttf"),
          "Cairo-ExtraBold": require("../assets/fonts/Cairo-ExtraBold.ttf"),
        },
  );

  useEffect(() => {
    if (!fontsLoaded && Platform.OS !== "web") return;
    Asset.loadAsync(IMAGES_TO_PRELOAD)
      .catch(() => {})
      .finally(async () => {
        setAppReady(true);
        await SplashScreen.hideAsync().catch(() => {});
      });
  }, [fontsLoaded]);

  const onLayoutRoot = useCallback(() => {}, []);

  if (!appReady) return <View style={{ flex: 1 }} onLayout={onLayoutRoot} />;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ThemeProvider>
                <AppProvider>
                  <AuthProvider>
                    <RootLayoutNav />
                  </AuthProvider>
                </AppProvider>
              </ThemeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
