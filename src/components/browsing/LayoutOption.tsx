import React, { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "../../theme/colors";

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
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      focusable
      onPress={() => onPress(id)}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
    >
      <View accessible={false} pointerEvents="none" style={styles.indicator}>
        {indicator}
      </View>
      <Text style={[styles.title, selected && styles.titleSelected]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    alignItems: "center",
    backgroundColor: colors.card2,
    borderColor: colors.border2,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    justifyContent: "center",
    minHeight: 72,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.78,
  },
  indicator: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 24,
  },
  title: {
    color: colors.text,
    fontWeight: "800",
    textAlign: "center",
  },
  titleSelected: {
    color: colors.bg,
  },
});
