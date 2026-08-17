import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "../../theme/AppThemeProvider";

export type PosterPlaceholderProps = {
  style?: StyleProp<ViewStyle>;
};

export function PosterPlaceholder({ style }: PosterPlaceholderProps) {
  const { theme } = useAppTheme();

  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      pointerEvents="none"
      style={[
        styles.placeholder,
        {
          backgroundColor: theme.global.surfaceSecondary,
          borderColor: theme.global.border,
        },
        style,
      ]}
    >
      <Ionicons
        color={theme.global.textSecondary}
        name="image-outline"
        size={26}
        style={styles.icon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    aspectRatio: 2 / 3,
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "center",
  },
  icon: {
    opacity: 0.22,
  },
});
