import {
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
  Tajawal_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/tajawal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { useNotificationSetup } from "@/hooks/useNotifications";

setBaseUrl(`https://${process.env["EXPO_PUBLIC_DOMAIN"]}`);

SplashScreen.preventAutoHideAsync();

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
      <Stack.Screen
        name="search"
        options={{ headerShown: false }}
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

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Tajawal_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

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
