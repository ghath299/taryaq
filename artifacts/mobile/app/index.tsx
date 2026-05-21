import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";

export default function Index() {
  const { isAuthenticated, isLoading, authStep } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.backgroundRoot }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  if (authStep === "complete-profile") return <Redirect href="/(auth)/complete-profile" />;
  if (authStep === "otp") return <Redirect href="/(auth)/otp" />;
  if (authStep === "location") return <Redirect href="/(auth)/location" />;
  return <Redirect href="/(tabs)" />;
}
