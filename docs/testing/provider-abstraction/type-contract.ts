import type {
  ProviderLocalSnapshot,
  ProviderMaterializationInput,
  ProviderMediaDetails,
  ProviderSearchCapability,
  ProviderSearchResult,
} from "../../../src/providers/providerContracts";

type Assert<T extends true> = T;
type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends
  (<T>() => T extends Right ? 1 : 2)
    ? true
    : false;
type HasKey<Value, Key extends PropertyKey> = Key extends keyof Value ? true : false;

type SearchResultKeys = Assert<Equal<
  keyof ProviderSearchResult,
  "reference" | "displayTitle" | "releaseLabel" | "posterUrl" | "description" | "kindLabel"
>>;
type SnapshotKeys = Assert<Equal<
  keyof ProviderLocalSnapshot,
  "type" | "title" | "year" | "posterUrl" | "overview" | "voteAverage"
>>;
type DetailKeys = Assert<Equal<keyof ProviderMediaDetails, "reference" | "snapshot">>;
type MaterializationKeys = Assert<Equal<
  keyof ProviderMaterializationInput,
  "reference" | "snapshot" | "initialTags"
>>;
type DetailsExcludeInitialTags = Assert<Equal<HasKey<ProviderMediaDetails, "initialTags">, false>>;
type MaterializationIncludesInitialTags = Assert<Equal<
  ProviderMaterializationInput["initialTags"],
  readonly string[]
>>;

type SearchParameters = Parameters<ProviderSearchCapability["search"]>;
type SearchHasOneParameter = Assert<Equal<SearchParameters["length"], 1>>;
type SearchQueryIsString = Assert<Equal<SearchParameters[0], string>>;
type SearchResultIsReadonlyArray = Assert<Equal<
  Awaited<ReturnType<ProviderSearchCapability["search"]>>,
  readonly ProviderSearchResult[]
>>;

// These names are deliberately absent from the shared contract surface.
// @ts-expect-error No provider descriptor exists without a current consumer.
import type { ProviderDescriptor } from "../../../src/providers/providerContracts";
// @ts-expect-error There is no provider-neutral remote detail operation.
import type { ProviderDetailCapability } from "../../../src/providers/providerContracts";

const reference = {
  provider: "example",
  resourceNamespace: "work",
  externalId: "opaque-id",
} as const;

const snapshot: ProviderLocalSnapshot = {
  type: "movie",
  title: "Ejemplo",
  year: 2026,
  posterUrl: "https://example.test/poster.jpg",
  overview: "Resumen",
  voteAverage: 8.1,
};

const details: ProviderMediaDetails = { reference, snapshot };
const materialization: ProviderMaterializationInput = {
  reference,
  snapshot,
  initialTags: ["Política explícita del proveedor"],
};

const search: ProviderSearchCapability = {
  async search(query) {
    return [{
      reference,
      displayTitle: query,
      releaseLabel: "2026",
      posterUrl: null,
      description: null,
      kindLabel: "Película",
    }];
  },
};

const rawTmdbSearchResult: ProviderSearchResult = {
  reference,
  displayTitle: "Ejemplo",
  releaseLabel: null,
  posterUrl: null,
  description: null,
  kindLabel: "Película",
  // @ts-expect-error Raw TMDB search fields are not part of a normalized result.
  media_type: "movie",
};

void details;
void materialization;
void search;
void rawTmdbSearchResult;
type ContractAssertions =
  | SearchResultKeys
  | SnapshotKeys
  | DetailKeys
  | MaterializationKeys
  | DetailsExcludeInitialTags
  | MaterializationIncludesInitialTags
  | SearchHasOneParameter
  | SearchQueryIsString
  | SearchResultIsReadonlyArray;
declare const contractAssertions: ContractAssertions;
void contractAssertions;
