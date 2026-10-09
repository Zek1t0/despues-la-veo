import type { ProviderMaterializationInput } from "../../../src/providers/providerContracts";
import type { SavedTitle } from "../../../src/core/savedTitle";
import { materializeProviderSavedTitle } from "../../../src/core/providerSavedTitle";
import { saveProviderTitle, saveProviderTitleWithDb } from "../../../src/storage/savedTitlesRepo";

type Assert<T extends true> = T;
type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends
  (<T>() => T extends Right ? 1 : 2) ? true : false;

type MaterializerInput = Assert<Equal<Parameters<typeof materializeProviderSavedTitle>[0], ProviderMaterializationInput>>;
type MaterializerOutput = Assert<Equal<ReturnType<typeof materializeProviderSavedTitle>, SavedTitle>>;
type PublicSaveInput = Assert<Equal<Parameters<typeof saveProviderTitle>[0], ProviderMaterializationInput>>;
type TransactionSaveInput = Assert<Equal<Parameters<typeof saveProviderTitleWithDb>[1], ProviderMaterializationInput>>;

const input: ProviderMaterializationInput = {
  reference: { provider: "fixture", resourceNamespace: "entry", externalId: "opaque" },
  snapshot: { medium: "audiovisual", contentFamily: null, primaryFormat: "movie", title: "Normalized", year: null, posterUrl: null,
    overview: null, genres: ["Remote genre"] },
  initialTags: ["Local creation tag"],
};

if (false) {
  materializeProviderSavedTitle(input, null, () => "opaque-local-id");
  void saveProviderTitle(input, () => "opaque-local-id");
  // @ts-expect-error A loose ID cannot cross the normalized save boundary.
  void saveProviderTitle("77", () => "opaque-local-id");
  // @ts-expect-error Raw TMDB DTOs are not local materialization inputs.
  materializeProviderSavedTitle({ id: 77, title: "TMDB", genres: [{ id: 1, name: "Drama" }] }, null, () => "opaque-local-id");
  // @ts-expect-error A legacy snapshot without reference/snapshot/initialTags is not accepted.
  void saveProviderTitle({ ...input.snapshot, externalId: "77" }, () => "opaque-local-id");
}

type Assertions = MaterializerInput | MaterializerOutput | PublicSaveInput | TransactionSaveInput;
declare const assertions: Assertions;
void assertions;
