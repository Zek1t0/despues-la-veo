import { useOrganization } from "../../../src/components/organization/useOrganization";
import React, { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { OrganizationPage, OrganizationText, OrganizationError } from "../../../src/components/organization/OrganizationUI";
import { useAppTheme } from "../../../src/theme/AppThemeProvider";
import { controlTarget, radius, space } from "../../../src/theme/presentation";
import { setCollectionMember } from "../../../src/storage/collectionsRepo";
export default function TitleCollectionsScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>(); const { snapshot,error,busy,refresh,run } = useOrganization();
  const { theme } = useAppTheme(); const { fontScale } = useWindowDimensions();
  const [focusedId,setFocusedId] = useState<string | null>(null);
  const item = snapshot?.items.find(v => v.id === itemId);
  return <OrganizationPage title="Añadir a colecciones"><OrganizationError error={error} retry={() => void refresh()} />
    {!snapshot ? <OrganizationText>Cargando colecciones…</OrganizationText> : !item ? <OrganizationText>El título ya no está en Biblioteca.</OrganizationText> : <>
      <OrganizationText muted>Elegí las colecciones de este título. Quitar una membresía no elimina el título.</OrganizationText>
      {!snapshot.collections.length && <OrganizationText>No hay colecciones. Creá una desde Biblioteca → Organizar → Colecciones.</OrganizationText>}
      {snapshot.collections.map(collection => {
        const member = snapshot.memberships.some(m => m.collectionId === collection.id && m.itemId === itemId);
        return <Pressable key={collection.id} accessibilityRole="checkbox" accessibilityLabel={`${member ? "Quitar de" : "Añadir a"} ${collection.name}`} accessibilityState={{ checked: member, disabled: busy }} disabled={busy} focusable onFocus={() => setFocusedId(collection.id)} onBlur={() => setFocusedId(null)}
          onPress={() => void run(() => setCollectionMember(collection.id,itemId,!member))}
          style={({ pressed }) => ({ minHeight: controlTarget, flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: 1,
            borderColor: focusedId === collection.id ? theme.global.accent : member ? theme.global.selectedBorder : theme.global.border, backgroundColor: theme.global.surface, opacity: busy ? 0.6 : pressed ? 0.8 : 1 })}>
          <Ionicons name={member ? "checkbox" : "square-outline"} size={24} color={member ? theme.global.selectedForeground : theme.global.textSecondary} accessible={false} />
          <View style={{ flex: 1, minWidth: 0, gap: space.xs }}><OrganizationText heading>{collection.name}</OrganizationText>
            {!!collection.description && <OrganizationText muted numberOfLines={fontScale > 1.5 ? undefined : 2}>{collection.description}</OrganizationText>}
            <OrganizationText muted>{member ? "En esta colección" : "Sin seleccionar"}</OrganizationText></View>
        </Pressable>;
      })}
    </>}
  </OrganizationPage>;
}
