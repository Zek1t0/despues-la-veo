import { Ionicons } from "@expo/vector-icons";
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
    >
      <Ionicons color={colors.muted} name="image-outline" size={26} style={styles.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    aspectRatio: 2 / 3,
    alignItems: "center",
    backgroundColor: colors.card2,
    borderColor: colors.border,
    borderWidth: 1,
    justifyContent: "center",
  },
  icon: {
    opacity: 0.22,
  },
});
