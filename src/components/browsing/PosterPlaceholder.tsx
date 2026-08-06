import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "../../theme/colors";

export type PosterPlaceholderProps = {
  style?: StyleProp<ViewStyle>;
};

export function PosterPlaceholder({ style }: PosterPlaceholderProps) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      pointerEvents="none"
      style={[styles.placeholder, style]}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    aspectRatio: 2 / 3,
    backgroundColor: colors.card2,
    borderColor: colors.border,
    borderWidth: 1,
  },
});
