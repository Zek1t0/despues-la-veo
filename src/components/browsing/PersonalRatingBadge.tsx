import React from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import type { PersonalRating } from "../../core/personalRating";
import { useAppTheme } from "../../theme/AppThemeProvider";
import {
  getPersonalRatingPresentation,
  type PersonalRatingTone,
} from "./personalRatingPresentation";

export type PersonalRatingBadgeProps = {
  value: PersonalRating;
  style?: StyleProp<ViewStyle>;
};

export function PersonalRatingBadge({
  value,
  style,
}: PersonalRatingBadgeProps) {
  const { theme } = useAppTheme();
  const presentation = getPersonalRatingPresentation(value);
  if (presentation === null) return null;

  const toneColors: Record<PersonalRatingTone, { backgroundColor: string; color: string }> = {
    low: {
      backgroundColor: theme.semantic.personalRatingLowBackground,
      color: theme.semantic.personalRatingLowForeground,
    },
    medium: {
      backgroundColor: theme.semantic.personalRatingMediumBackground,
      color: theme.semantic.personalRatingMediumForeground,
    },
    high: {
      backgroundColor: theme.semantic.personalRatingHighBackground,
      color: theme.semantic.personalRatingHighForeground,
    },
  };
  const visualColors = toneColors[presentation.tone];

  return (
    <View
      accessibilityElementsHidden
      accessible={false}
      focusable={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.badge,
        { backgroundColor: visualColors.backgroundColor },
        style,
      ]}
    >
      <Text
        accessible={false}
        style={[styles.text, { color: visualColors.color }]}
      >
        {presentation.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
  },
});
