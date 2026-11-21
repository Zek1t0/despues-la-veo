import React from "react";
import { Text } from "react-native";
import type { PersonalProgress } from "../../core/personalProgress";
import { progressPositionLabel } from "../../core/personalProgressPresentation";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { type } from "../../theme/presentation";

export function PersonalProgressSummary({ progress, incompatible = false }: { progress?: PersonalProgress | null; incompatible?: boolean }) {
  const { theme } = useAppTheme();
  if (!progress?.position) return null;
  return <Text numberOfLines={1} accessibilityLabel={`Mi progreso: ${progressPositionLabel(progress.position)}${incompatible ? ". Clasificación incompatible; posición conservada" : ""}`}
    style={[type.caption, { color: incompatible ? theme.semantic.dangerText : theme.global.textSecondary, flexShrink: 1 }]}>
    {progressPositionLabel(progress.position, true)}{incompatible ? " · Revisar formato" : ""}
  </Text>;
}
