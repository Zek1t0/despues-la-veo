import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../src/theme/AppThemeProvider";
import { radius, space, type } from "../../src/theme/presentation";
import { Text } from "react-native";
import { OrganizationPage, OrganizationCard, OrganizationText } from "../../src/components/organization/OrganizationUI";
export default function OrganizeScreen() {
  const router = useRouter(); const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const iconStyle = { width: 48, height: 48, borderRadius: radius.control, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: theme.global.surfaceSecondary };
  return <OrganizationPage title="Organizar">
    <Pressable accessibilityRole="button" accessibilityLabel="Colecciones. Agrupá tus títulos guardados en listas personales." focusable onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={() => router.push("/organize/collections")}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.lg, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: focused ? theme.global.accent : theme.global.border, backgroundColor: theme.global.surface, opacity: pressed ? 0.8 : 1 })}>
      <View style={iconStyle}><Ionicons name="folder-outline" size={25} color={theme.global.textPrimary} accessible={false} /></View>
      <View style={{ flex: 1, minWidth: 0, gap: space.xs }}><OrganizationText heading>Colecciones</OrganizationText><OrganizationText muted>Agrupá tus títulos guardados en listas personales.</OrganizationText></View>
      <Ionicons name="chevron-forward" size={20} color={theme.global.textSecondary} accessible={false} />
    </Pressable>
    <OrganizationCard style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
      <View style={iconStyle}><Ionicons name="file-tray-outline" size={25} color={theme.global.textMuted} accessible={false} /></View>
      <View style={{ flex: 1, minWidth: 0, gap: space.sm }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center" }}><OrganizationText heading>Bandeja de recomendaciones</OrganizationText>
          <Text style={[type.caption, { color: theme.global.textSecondary, backgroundColor: theme.global.surfaceSecondary, borderRadius: radius.round, paddingHorizontal: space.sm, paddingVertical: space.xs }]}>Próximamente</Text></View>
        <OrganizationText muted>Guardá recomendaciones para revisarlas después. Disponible en una próxima entrega.</OrganizationText>
      </View>
    </OrganizationCard>
  </OrganizationPage>;
}
