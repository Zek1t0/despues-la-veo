import React from "react";
import { Text, View } from "react-native";

import type { ProgressPosition } from "../../core/personalProgress";
import { progressPositionLabel } from "../../core/personalProgressPresentation";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { space, type } from "../../theme/presentation";

/** A manual position, never a count of consumed units. No editorial data is inferred. */
export function PersonalProgressPosition({ position }: { position: ProgressPosition }) {
  const { theme } = useAppTheme();
  const parts = position.mode === "season-episode"
    ? [{ label: "TEMPORADA", value: String(position.season).padStart(2, "0") }, { label: "EPISODIO", value: String(position.episode).padStart(2, "0") }]
    : position.mode === "episode" ? [{ label: "EPISODIO", value: String(position.episode) }]
    : position.mode === "chapter" ? [{ label: "CAPÍTULO", value: position.chapter }]
    : [{ label: "POSICIÓN ESPECIAL", value: position.label }];
  return <View accessible accessibilityLabel={progressPositionLabel(position)} accessibilityHint="Última posición manual; no acredita todos los anteriores." style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.xl, rowGap: space.md }}>
      {parts.map((part, index) => <View key={part.label} style={{ flexShrink: 1, minWidth: 0, gap: space.xs, ...(index ? { borderLeftWidth: 1, borderColor: theme.global.borderStrong, paddingLeft: space.xl } : {}) }}>
        <Text style={[type.caption, { color: theme.global.textSecondary, letterSpacing: 1 }]}>{part.label}</Text>
        <Text style={{ color: theme.global.textPrimary, fontSize: position.mode === "special" ? 28 : position.mode === "chapter" ? 40 : 48, lineHeight: position.mode === "special" ? 36 : position.mode === "chapter" ? 48 : 54, fontWeight: "800", fontVariant: ["tabular-nums"], flexShrink: 1 }}>{part.value}</Text>
      </View>)}
    </View>
  </View>;
}
