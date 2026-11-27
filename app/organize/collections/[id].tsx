import { useOrganization } from "../../../src/components/organization/useOrganization";
import { PersonalProgressSummary } from "../../../src/components/progress/PersonalProgressSummary";
import { progressPositionCompatible } from "../../../src/core/personalProgress";
import { progressPositionLabel } from "../../../src/core/personalProgressPresentation";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { OrganizationPage, OrganizationButton, OrganizationCard, OrganizationText, OrganizationInput, OrganizationError } from "../../../src/components/organization/OrganizationUI";
import { CollectionOptionsMenu } from "../../../src/components/organization/CollectionOptionsMenu";
import { CollectionForm } from "../../../src/components/organization/CollectionForm";
import { CollectionCover } from "../../../src/components/organization/CollectionCover";
import { MediaPoster } from "../../../src/components/browsing/MediaPoster";
import { useAppTheme } from "../../../src/theme/AppThemeProvider";
import { radius, space } from "../../../src/theme/presentation";
import { deleteCollection, setCollectionMember } from "../../../src/storage/collectionsRepo";
import { savedContentVisible, SENSITIVE_FILTER_COVERAGE } from "../../../src/core/sensitiveContent";
import { compareLibraryTitles } from "../../../src/core/libraryView";
import { presentSavedTitle, matchesLocalMediaQuery } from "../../../src/core/mediaViewProjection";
import { savedMediaPresentation } from "../../../src/core/mediaPresentation";
import { mediaClassificationLabel, titleStatusLabel } from "../../../src/core/presentationLabels";
import type { SavedTitleWithProviderReferences } from "../../../src/core/savedTitle";
export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter();
  const { snapshot,error,busy,refresh,run } = useOrganization();
  const { width,fontScale } = useWindowDimensions(); const { theme } = useAppTheme();
  const [editing,setEditing] = useState(false), [deleting,setDeleting] = useState(false), [adding,setAdding] = useState(false), [query,setQuery] = useState("");
  const [alphabetic,setAlphabetic] = useState(false);
  const optionsTrigger = useRef<View>(null), cancelConfirmation = useRef<View>(null);
  useEffect(() => {
    if (!deleting) return;
    const frame = requestAnimationFrame(() => cancelConfirmation.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [deleting]);
  const [focusedMember,setFocusedMember] = useState<string | null>(null);
  const collection = snapshot?.collections.find(v => v.id === id);
  const memberships = snapshot?.memberships.filter(v => v.collectionId === id).sort((a,b) => b.addedAt-a.addedAt || a.itemId.localeCompare(b.itemId)) ?? [];
  const visible = snapshot?.items.filter(item => savedContentVisible(item,snapshot.preferences.value.hideSensitive)).map(item => presentSavedTitle(item,snapshot.preferences.value.languages)) ?? [];
  const incorporated = memberships.flatMap(m => { const item = visible.find(v => v.id === m.itemId); return item ? [item] : []; });
  const members = alphabetic ? [...incorporated].sort((a,b) => compareLibraryTitles(a,b,"title-asc")) : incorporated;
  const candidates = visible.filter(item => matchesLocalMediaQuery(item,query));
  const stackHeader = width / Math.max(1,fontScale) < 380;
  const stackRows = width / Math.max(1,fontScale) < 240;
  const poster = (item: SavedTitleWithProviderReferences) => <MediaPoster context="list" identity={item.id} posterUrl={item.posterUrl} imageProvider={savedMediaPresentation(item).imageProvider} metadata={savedMediaPresentation(item).metadata} style={{ width: 40, height: 60, borderRadius: radius.control, flexShrink: 0 }} />;
  const identity = (item: SavedTitleWithProviderReferences) => <View style={{ flex: 1, minWidth: 0, gap: space.xs }}><OrganizationText heading>{item.title}{item.year ? ` (${item.year})` : ""}</OrganizationText><OrganizationText muted>{mediaClassificationLabel(item)} · {titleStatusLabel(item.status,item.medium)}</OrganizationText><PersonalProgressSummary marked={snapshot?.granularCounts?.[item.id]} progress={snapshot?.progressById?.[item.id]} incompatible={!!snapshot?.progressById?.[item.id]?.position && !progressPositionCompatible(item, snapshot.progressById[item.id].position)} /></View>;
  return <OrganizationPage title={collection?.name ?? "Colección"}><OrganizationError error={error} retry={() => void refresh()} />
    {!snapshot ? <OrganizationText>{error ? "No se pudo cargar la colección." : "Cargando colección…"}</OrganizationText> : !collection ? <OrganizationText>La colección ya no existe.</OrganizationText> : <>
      <View style={{ flexDirection: stackHeader ? "column" : "row", alignItems: "flex-start", gap: space.lg }}>
        <CollectionCover members={incorporated} width={stackHeader ? 72 : 96} />
        <View style={{ flex: stackHeader ? undefined : 1, alignSelf: "stretch", minWidth: 0, gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
            <View style={{ flex: 1, minWidth: 0, gap: space.sm }}>
              <OrganizationText heading prominent>{collection.name}</OrganizationText>
              {!!collection.description && <OrganizationText muted>{collection.description}</OrganizationText>}
              <OrganizationText>{members.length} títulos visibles</OrganizationText>
            </View>
            <CollectionOptionsMenu triggerRef={optionsTrigger} disabled={busy} onDelete={() => setDeleting(true)} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center" }}>
            <OrganizationButton label={adding ? "Cerrar selector" : "Agregar títulos"} icon={adding ? "close-outline" : "add"} variant="primary" disabled={busy} expanded={adding} onPress={() => setAdding(v => !v)} />
            <OrganizationButton label="Editar" icon="create-outline" disabled={busy} expanded={editing} onPress={() => setEditing(v => !v)} />
          </View>
        </View>
      </View>
      {editing && <CollectionForm key={collection.id} collection={collection} busy={busy} run={run} done={() => setEditing(false)} />}
      {deleting && <OrganizationCard><OrganizationText>¿Eliminar esta colección? Los títulos seguirán en Biblioteca.</OrganizationText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <OrganizationButton label="Confirmar eliminación de colección" variant="danger" disabled={busy} onPress={() => void (async () => { if (await run(() => deleteCollection(collection.id))) router.replace("/organize/collections"); })()} />
          <OrganizationButton label="Cancelar eliminación" buttonRef={cancelConfirmation} disabled={busy} onPress={() => { setDeleting(false); requestAnimationFrame(() => optionsTrigger.current?.focus()); }} />
        </View></OrganizationCard>}
      {snapshot.preferences.value.hideSensitive && <OrganizationText muted>{SENSITIVE_FILTER_COVERAGE}</OrganizationText>}
      {adding && <OrganizationCard><OrganizationText heading>Agregar desde Biblioteca</OrganizationText><OrganizationInput label="Buscar títulos de Biblioteca" value={query} onChangeText={setQuery} />
        {candidates.map(item => {
          const member = memberships.some(m => m.itemId === item.id);
          return <View key={item.id} style={{ flexDirection: stackRows ? "column" : "row", alignItems: stackRows ? "stretch" : "center", gap: space.md, paddingVertical: space.sm }}>
            <View style={{ flex: stackRows ? undefined : 1, minWidth: 0, flexDirection: "row", gap: space.md, alignItems: "center" }}>{poster(item)}{identity(item)}</View>
            <OrganizationButton label={member ? "Ya pertenece" : "Agregar"} accessibilityLabel={member ? `${item.title} ya pertenece a la colección` : `Agregar ${item.title}`} icon={member ? "checkmark" : "add"} selected={member} disabled={busy || member} onPress={() => void run(() => setCollectionMember(collection.id,item.id,true))} />
          </View>;
        })}
        {!candidates.length && <OrganizationText>No hay títulos visibles con esta búsqueda.</OrganizationText>}
      </OrganizationCard>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm }}>
        <OrganizationText muted>Orden:</OrganizationText>
        <OrganizationButton label="Incorporación reciente" selected={!alphabetic} onPress={() => setAlphabetic(false)} />
        <OrganizationButton label="Título A–Z" selected={alphabetic} onPress={() => setAlphabetic(true)} />
      </View>
      {!members.length && <OrganizationCard><OrganizationText>{memberships.length ? "No hay miembros visibles con el filtro actual." : "Esta colección está vacía. Agregá títulos desde tu Biblioteca."}</OrganizationText></OrganizationCard>}
      <View style={{ gap: space.sm }}>
      {members.map(item => <View key={item.id} style={{ flexDirection: stackRows ? "column" : "row", alignItems: stackRows ? "stretch" : "center", gap: space.sm, borderWidth: 1, borderColor: theme.global.border, borderRadius: radius.card, backgroundColor: theme.global.surface, padding: space.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${item.title}${snapshot?.progressById?.[item.id]?.position ? `. Última posición manual: ${progressPositionLabel(snapshot.progressById[item.id].position!)}` : ""}${snapshot?.granularCounts?.[item.id] ? `. ${snapshot.granularCounts[item.id]} unidades marcadas` : ""}`} focusable onFocus={() => setFocusedMember(item.id)} onBlur={() => setFocusedMember(null)} onPress={() => router.push({ pathname: "/title/[id]", params: { id: item.id } })}
          style={({ pressed }) => ({ flex: stackRows ? undefined : 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space.md, padding: space.xs, minHeight: 60, borderWidth: 1, borderRadius: radius.control, borderColor: focusedMember === item.id ? theme.global.accent : theme.global.surface, opacity: pressed ? 0.8 : 1 })}>
          {poster(item)}{identity(item)}
        </Pressable>
        <OrganizationButton label="Quitar" accessibilityLabel={`Quitar ${item.title} de la colección`} icon="trash-outline" variant="quiet" disabled={busy} onPress={() => void run(() => setCollectionMember(collection.id,item.id,false))} />
      </View>)}
      </View>
    </>}
  </OrganizationPage>;
}
