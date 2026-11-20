import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../src/theme/AppThemeProvider";
import { radius, space } from "../../src/theme/presentation";
import { OrganizationPage, OrganizationText } from "../../src/components/organization/OrganizationUI";
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
    <Pressable accessibilityRole="button" accessibilityLabel="Bandeja de recomendaciones" focusable onPress={()=>router.push("/organize/recommendations")}
      style={({pressed})=>({flexDirection:"row",alignItems:"center",gap:space.lg,padding:space.lg,borderRadius:radius.card,borderWidth:1,borderColor:theme.global.border,backgroundColor:theme.global.surface,opacity:pressed ? 0.8 : 1})}>
      <View style={iconStyle}><Ionicons name="file-tray-outline" size={25} color={theme.global.textPrimary} accessible={false}/></View>
      <View style={{flex:1,minWidth:0,gap:space.xs}}><OrganizationText heading>Bandeja de recomendaciones</OrganizationText><OrganizationText muted>Guardá sugerencias con su contexto y decidí después qué incorporar a Biblioteca.</OrganizationText></View>
      <Ionicons name="chevron-forward" size={20} color={theme.global.textSecondary} accessible={false}/>
    </Pressable>
  </OrganizationPage>;
}
