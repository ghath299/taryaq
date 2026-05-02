import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <EmptyState
        icon="package"
        title="لا توجد طلبات"
        description="ستظهر طلبات الأدوية هنا بعد إطلاق خدمة الصيدليات"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
