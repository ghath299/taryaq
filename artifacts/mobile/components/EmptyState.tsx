import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, addAlpha } from "@/constants/colors";

interface EmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = "inbox", title, description, actionLabel, onAction }: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
      <Animated.View entering={FadeInUp.delay(100).duration(400)}>
        <View style={[styles.iconWrap, { backgroundColor: addAlpha(theme.primary, 0.1) }]}>
          <Feather name={icon} size={48} color={theme.primary} />
        </View>
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.textContainer}>
        <ThemedText type="h3" style={styles.title}>{title}</ThemedText>
        {description ? (
          <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
            {description}
          </ThemedText>
        ) : null}
      </Animated.View>
      {actionLabel && onAction ? (
        <Animated.View entering={FadeInUp.delay(300).duration(400)}>
          <Button onPress={onAction} style={styles.button}>{actionLabel}</Button>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing["3xl"] },
  iconWrap: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: Spacing["2xl"] },
  textContainer: { alignItems: "center", marginBottom: Spacing.xl },
  title: { textAlign: "center", marginBottom: Spacing.sm },
  description: { textAlign: "center" },
  button: { paddingHorizontal: Spacing["3xl"] },
});
