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
import { metadataPill } from "../../theme/presentation";
import {
  getPersonalRatingPresentation,
  type PersonalRatingTone,
} from "./personalRatingPresentation";

export type PersonalRatingBadgeProps = {
  value: PersonalRating;
  showPersonalLabel?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PersonalRatingBadge({
  value,
  showPersonalLabel = false,
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
        showPersonalLabel ? metadataPill.container : styles.badge,
        showPersonalLabel
          ? { backgroundColor: `${visualColors.backgroundColor}24`, borderColor: theme.global.borderStrong }
          : { backgroundColor: visualColors.backgroundColor },
        style,
      ]}
    >
      <Text
        accessible={false}
        style={[
          showPersonalLabel ? metadataPill.text : styles.text,
          { color: showPersonalLabel ? theme.global.textPrimary : visualColors.color },
        ]}
      >
        {showPersonalLabel ? `★ Mi ${presentation.text.replace(".", ",")}` : presentation.text}
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
