import { Stack } from "expo-router";
import { Platform } from "react-native";

export default function AuthLayout() {
  return (
    <>
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
          contentStyle: { backgroundColor: "#0A0F1A" },
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
