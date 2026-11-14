import type { ProviderLocalSnapshot, ProviderMediaDetails, ProviderMaterializationInput, ProviderSearchResult } from "../../../src/providers/providerContracts";
import type { EnrichedMediaMetadata } from "../../../src/core/enrichedMediaMetadata";
import type { MetadataPatch } from "../../../src/core/metadataPatch";

const metadata: EnrichedMediaMetadata = {
  version: 1,
  provenance: { reference: { provider: "kitsu", resourceNamespace: "anime", externalId: "1" },
    normalizerVersion: 1, fetchedAt: null, checkedAt: null, sourceUpdatedAt: null },
  fields: { publicRating: { provider: "kitsu", originalValue: "82.280", originalScale: { min: 0, max: 100 } },
    sensitive: false, totalLengthMinutes: null },
};
const patch: MetadataPatch = { episodeCount: { kind: "known", value: 0 }, totalLengthMinutes: { kind: "unknown" },
  startDate: { kind: "not-provided" } };
type Assert<T extends true> = T;
type _SidecarsOptional = Assert<undefined extends ProviderMediaDetails["metadata"] & ProviderMaterializationInput["metadata"] & ProviderSearchResult["metadata"] ? true : false>;
type _LegacySnapshotUnchanged = Assert<"metadata" extends keyof ProviderLocalSnapshot ? false : true>;
if (false) {
  // @ts-expect-error Metadata is readonly and never a mutable personal record.
  metadata.fields.sensitive = true;
  // @ts-expect-error Personal fields do not belong to a provider patch.
  const personal: MetadataPatch = { notes: { kind: "known", value: "private" } };
  // @ts-expect-error Unknown is explicit; known requires a valid non-null number.
  const invalid: MetadataPatch = { episodeCount: { kind: "known", value: null } };
  // @ts-expect-error Metadata timestamps are independent of SavedTitle.updatedAt.
  metadata.provenance.updatedAt;
  void personal; void invalid;
}
void metadata; void patch;
