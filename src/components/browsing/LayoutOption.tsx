import React, { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { controlTarget, pressedFeedback, radius, space, type } from "../../theme/presentation";
import { useAppTheme } from "../../theme/AppThemeProvider";

export type LayoutOptionProps = {
  id: string;
  title: string;
  indicator: ReactNode;
  selected: boolean;
  onPress: (id: string) => void;
  accessibilityLabel?: string;
};

export function LayoutOption({
  id,
  title,
  indicator,
  selected,
  onPress,
  accessibilityLabel,
}: LayoutOptionProps) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      focusable
      onPress={() => onPress(id)}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected
            ? theme.global.selectedSurface
            : theme.global.surfaceSecondary,
          borderColor: selected
            ? theme.global.selectedBorder
            : theme.global.borderStrong,
        },
        pressed && pressedFeedback,
      ]}
    >
      <View accessible={false} pointerEvents="none" style={styles.indicator}>
        {indicator}
      </View>
      <Text
        style={[
          styles.title,
          {
            color: selected
              ? theme.global.selectedForeground
              : theme.global.textPrimary,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    alignItems: "center",
    borderRadius: radius.control,
    borderWidth: 1,
    flex: 1,
    gap: space.sm,
    justifyContent: "center",
    minHeight: 72,
    minWidth: 96,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  indicator: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 24,
  },
  title: {
    ...type.control,
    textAlign: "center",
  },
});
