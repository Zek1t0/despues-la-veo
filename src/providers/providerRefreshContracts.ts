import type { EnrichedMediaMetadata, MetadataDiagnostic } from "../core/enrichedMediaMetadata";
import type { SavedTitleWithProviderReferences } from "../core/savedTitle";
export type RefreshEligibility = Readonly<{
    enabled: boolean;
    reason?: string;
}>;
export type ProviderRefreshPayload = Readonly<{
    metadata: EnrichedMediaMetadata;
    snapshotPatch?: Readonly<{
        year?: number;
    }>;
    diagnostics: readonly MetadataDiagnostic[];
}>;
/** Optional finite provider binding; no registry, credentials or raw DTOs in the shared contract. */
export interface ProviderMetadataRefreshCapability {
    readonly fields: readonly string[];
    eligibility(item: SavedTitleWithProviderReferences): RefreshEligibility;
    scope(): string;
    load(item: SavedTitleWithProviderReferences, signal: AbortSignal): Promise<ProviderRefreshPayload>;
}
