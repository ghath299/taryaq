import { Stack } from "expo-router";
import { Platform } from "react-native";
import { useTheme } from "@/hooks/useTheme";

export default function AuthLayout() {
  const { theme } = useTheme();
  return (
    <>
      {/* recaptcha-container هنا يبقى موجود في كل شاشات المصادقة */}
      {Platform.OS === "web" && (
        <div
          id="recaptcha-container"
          style={{
            position: "fixed",
            bottom: 20,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 9999,
          }}
        />
      )}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.backgroundRoot },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="location" />
        <Stack.Screen name="otp" />
        <Stack.Screen name="complete-profile" />
      </Stack>
    </>
  );
}
