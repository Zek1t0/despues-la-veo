import type { ProviderReference } from "../core/providerReference";
import { providerReferencesEqual } from "../core/providerReference";
import type { SavedTitleWithProviderReferences } from "../core/savedTitle";
import type { ProviderMetadataRefreshCapability, RefreshEligibility } from "../providers/providerRefreshContracts";
export type RefreshBindings = Readonly<{
    tmdb: ProviderMetadataRefreshCapability;
    kitsu: ProviderMetadataRefreshCapability;
    mangaupdates: ProviderMetadataRefreshCapability;
}>;
export function refreshReference(item: SavedTitleWithProviderReferences): ProviderReference | null {
    if (item.manualIdentity || !item.providerReferences.length)
        return null;
    const ref = item.metadataState ? item.metadataState.selection.reference : item.providerReferences.length === 1 ? item.providerReferences[0] : null;
    return ref && item.providerReferences.some(known => providerReferencesEqual(known, ref)) ? ref : null;
}
export function resolveRefreshCapability(item: SavedTitleWithProviderReferences, bindings: RefreshBindings): RefreshEligibility & {
    capability?: ProviderMetadataRefreshCapability;
    reference?: ProviderReference;
} {
    if (item.manualIdentity || !item.providerReferences.length)
        return { enabled: false, reason: "Las entradas manuales se editan localmente." };
    const reference = refreshReference(item);
    if (!reference)
        return { enabled: false, reason: "Elegí una fuente de presentación antes de actualizar." };
    const capability = reference.provider === "tmdb" ? bindings.tmdb : reference.provider === "kitsu" ? bindings.kitsu : reference.provider === "mangaupdates" ? bindings.mangaupdates : undefined;
    if (!capability)
        return { enabled: false, reason: "Esta fuente no admite actualización." };
    return { ...capability.eligibility(item), capability, reference };
}
