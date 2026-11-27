import React from "react";
import { Text } from "react-native";
import type { PersonalProgress } from "../../core/personalProgress";
import { progressPositionLabel } from "../../core/personalProgressPresentation";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { type } from "../../theme/presentation";

export function PersonalProgressSummary({ progress, incompatible = false, marked = 0 }: { marked?: number; progress?: PersonalProgress | null; incompatible?: boolean }) {
  const { theme } = useAppTheme();
  if (!progress?.position && !marked) return null;
  return <Text numberOfLines={1} accessibilityLabel={[progress?.position ? `Última posición manual: ${progressPositionLabel(progress.position)}` : null, incompatible ? "Clasificación incompatible; posición conservada" : null, marked ? `${marked} unidades marcadas` : null].filter(Boolean).join(". ")}
    style={[type.caption, { color: incompatible ? theme.semantic.dangerText : theme.global.textSecondary, flexShrink: 1 }]}>
    {[progress?.position ? progressPositionLabel(progress.position, true) : null, incompatible ? "Revisar formato" : null, marked ? `${marked} marcadas` : null].filter(Boolean).join(" · ")}
  </Text>;
}
