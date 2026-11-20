import { useOrganization } from "../../../src/components/organization/useOrganization";
import React, { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { OrganizationPage, OrganizationButton, OrganizationText, OrganizationError } from "../../../src/components/organization/OrganizationUI";
import { CollectionForm } from "../../../src/components/organization/CollectionForm";
import { CollectionCover } from "../../../src/components/organization/CollectionCover";
import { useAppTheme } from "../../../src/theme/AppThemeProvider";
import { radius, space } from "../../../src/theme/presentation";
import { savedContentVisible, SENSITIVE_FILTER_COVERAGE } from "../../../src/core/sensitiveContent";
export default function CollectionsScreen() {
  const router = useRouter(), { snapshot,error,busy,refresh,run } = useOrganization(); const [creating,setCreating] = useState(false);
  const { width, fontScale } = useWindowDimensions(); const { theme } = useAppTheme();
  const [focusedId,setFocusedId] = useState<string | null>(null);
  const twoColumns = width >= 840 * Math.max(1,fontScale);
  const newAction = () => <OrganizationButton label="Nueva colección" icon="add" disabled={!snapshot || busy || creating} onPress={() => setCreating(true)} />;
  return <OrganizationPage title="Colecciones"><OrganizationError error={error} retry={() => void refresh()} />
    {!snapshot ? <OrganizationText>{error ? "No se pudieron cargar las colecciones." : "Cargando colecciones…"}</OrganizationText> : <>
      {creating && <CollectionForm busy={busy} run={run} done={() => setCreating(false)} />}
      {snapshot.preferences.value.hideSensitive && <OrganizationText>{SENSITIVE_FILTER_COVERAGE}</OrganizationText>}
      {!snapshot.collections.length && <OrganizationText>Todavía no hay colecciones. Creá una vacía y agregá títulos cuando quieras.</OrganizationText>}
      {newAction()}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.lg }}>
      {snapshot.collections.map(collection => {
        const memberships = snapshot.memberships.filter(m => m.collectionId === collection.id).sort((a,b) => b.addedAt-a.addedAt || a.itemId.localeCompare(b.itemId));
        const members = memberships.flatMap(m => { const item = snapshot.items.find(v => v.id === m.itemId); return item && savedContentVisible(item,snapshot.preferences.value.hideSensitive) ? [item] : []; });
        return <Pressable key={collection.id} accessibilityRole="button" accessibilityLabel={`Abrir colección ${collection.name}. ${members.length} títulos visibles.`} focusable onFocus={() => setFocusedId(collection.id)} onBlur={() => setFocusedId(null)}
          onPress={() => router.push({ pathname: "/organize/collections/[id]", params: { id: collection.id } })}
          style={({ pressed }) => ({ width: twoColumns ? "48%" : "100%", flexGrow: twoColumns ? 1 : 0, maxWidth: twoColumns ? "49%" : "100%", flexDirection: "row", alignItems: "center", padding: space.md, gap: space.md, borderRadius: radius.card, borderWidth: 1,
            borderColor: focusedId === collection.id ? theme.global.accent : theme.global.border, backgroundColor: theme.global.surface, opacity: pressed ? 0.8 : 1 })}>
          <CollectionCover members={members} width={fontScale > 1.5 ? 56 : 72} />
          <View style={{ flex: 1, minWidth: 0, gap: space.sm }}><OrganizationText heading>{collection.name}</OrganizationText>
            {!!collection.description && <OrganizationText muted numberOfLines={2}>{collection.description}</OrganizationText>}
            <OrganizationText>{members.length} títulos visibles</OrganizationText>
            {memberships.length > members.length && <OrganizationText muted>Hay contenido oculto</OrganizationText>}
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.global.textSecondary} accessible={false} />
        </Pressable>;
      })}
      </View>
    </>}
  </OrganizationPage>;
}
