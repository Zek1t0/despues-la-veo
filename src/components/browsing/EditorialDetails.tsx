import React from "react";
import { Text, View } from "react-native";
import type { EditorialRow } from "../../core/editorialPresentation";
import { useAppTheme } from "../../theme/AppThemeProvider";
/** Plain provider-neutral text; no links, HTML, requests or personal mutations. */
export function EditorialDetails({ rows }: { rows: readonly EditorialRow[] }) {
  const { theme } = useAppTheme();
  if (!rows.length) return null;
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={{ color: theme.global.textPrimary, fontSize: 18, fontWeight: "800" }}>Ficha editorial</Text>
    {rows.map(row => <View key={row.label} style={{ gap: 4 }}>
      <Text style={{ color: theme.global.textPrimary, fontWeight: "700" }}>{row.label}</Text>
      <Text selectable style={{ color: theme.global.textSecondary }}>{row.value}</Text>
      <Text style={{ color: theme.global.textMuted, fontSize: 12 }}>Fuente: {row.source}</Text>
    </View>)}
  </View>;
}
