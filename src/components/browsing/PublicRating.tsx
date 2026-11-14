import React from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import type { PublicRating as PublicRatingValue } from "../../core/publicRating";
import { publicRatingLabel } from "../../core/mediaPresentation";
import { useAppTheme } from "../../theme/AppThemeProvider";
/** Public provider score, deliberately separate from PersonalRatingBadge. */
export function PublicRating({ value, style }: { value?: PublicRatingValue | null; style?: StyleProp<TextStyle> }) {
  const { theme } = useAppTheme();
  const label = publicRatingLabel(value);
  return label ? <Text accessibilityLabel={label} style={[{ color: theme.global.textSecondary, fontSize: 13, fontWeight: "600" }, style]}>{label}</Text> : null;
}
