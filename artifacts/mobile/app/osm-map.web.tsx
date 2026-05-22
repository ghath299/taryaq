import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

export default function OsmMapWeb() {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Feather name="map-pin" size={56} color={theme.textSecondary} />
      <ThemedText type="h3" style={{ color: theme.text, marginTop: 16, fontWeight: "700" }}>
        الخريطة غير متاحة
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 8, textAlign: "center" }}>
        هذه الميزة متاحة على تطبيق الجوال فقط
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
});
