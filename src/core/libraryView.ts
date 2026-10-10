import type { SavedTitle, TitleStatus } from "./savedTitle";
import type { LibrarySort } from "./viewPreferences";

export type LibraryStatusFilter = "all" | TitleStatus;
export const LIBRARY_CLASSIFICATION_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "movie", label: "Películas" },
  { value: "tv", label: "Series" },
  { value: "anime", label: "Anime" },
  { value: "manga", label: "Manga" },
  { value: "manhwa", label: "Manhwa" },
  { value: "manhua", label: "Manhua" },
  { value: "comic", label: "Cómics" },
  { value: "literature", label: "Literatura" },
] as const;
export type LibraryClassificationFilter = (typeof LIBRARY_CLASSIFICATION_FILTERS)[number]["value"];

export function isLibraryClassificationFilter(value: string): value is LibraryClassificationFilter {
  return LIBRARY_CLASSIFICATION_FILTERS.some(option => option.value === value);
}

/** A single active predicate; these options are overlapping views, not domain types. */
export function matchesLibraryClassification(item: SavedTitle, filter: LibraryClassificationFilter): boolean {
  switch (filter) {
    case "all": return true;
    case "movie": case "tv": return item.medium === "audiovisual" && item.primaryFormat === filter;
    case "anime": case "manga": case "manhwa": case "manhua": return item.contentFamily === filter;
    case "comic": case "literature": return item.medium === filter;
  }
}

const SPANISH_TITLE_COLLATOR = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

function compareTitleThenId(a: SavedTitle, b: SavedTitle): number {
  return SPANISH_TITLE_COLLATOR.compare(a.title, b.title) || a.id.localeCompare(b.id);
}

function compareOptionalNumberDescending(
  a: number | null | undefined,
  b: number | null | undefined
): number {
  const aPresent = typeof a === "number" && Number.isFinite(a);
  const bPresent = typeof b === "number" && Number.isFinite(b);
  if (aPresent && bPresent) return b - a;
  if (aPresent) return -1;
  if (bPresent) return 1;
  return 0;
}

function comparePersonalRating(
  a: SavedTitle,
  b: SavedTitle,
  direction: "asc" | "desc"
): number {
  if (a.personalRating === null && b.personalRating === null) {
    return compareTitleThenId(a, b);
  }
  if (a.personalRating === null) return 1;
  if (b.personalRating === null) return -1;

  const primary =
    direction === "asc"
      ? a.personalRating - b.personalRating
      : b.personalRating - a.personalRating;
  return primary || compareTitleThenId(a, b);
}

export function compareLibraryTitles(
  a: SavedTitle,
  b: SavedTitle,
  sort: LibrarySort
): number {
  let primary = 0;

  switch (sort) {
    case "updated-desc":
      primary = b.updatedAt - a.updatedAt;
      break;
    case "title-asc":
      primary = SPANISH_TITLE_COLLATOR.compare(a.title, b.title);
      break;
    case "title-desc":
      primary = SPANISH_TITLE_COLLATOR.compare(b.title, a.title);
      break;
    case "rating-desc":
      primary = compareOptionalNumberDescending(a.voteAverage, b.voteAverage);
      break;
    case "personal-rating-desc":
      return comparePersonalRating(a, b, "desc");
    case "personal-rating-asc":
      return comparePersonalRating(a, b, "asc");
    case "year-desc":
      primary = compareOptionalNumberDescending(a.year, b.year);
      break;
  }

  return primary || compareTitleThenId(a, b);
}

export function comparePinnedLibraryTitles(
  a: SavedTitle,
  b: SavedTitle,
  pinnedAtById: ReadonlyMap<string, number>,
  sort: LibrarySort
): number {
  const aPinnedAt = pinnedAtById.get(a.id);
  const bPinnedAt = pinnedAtById.get(b.id);
  if (aPinnedAt !== undefined && bPinnedAt !== undefined && aPinnedAt !== bPinnedAt) {
    return aPinnedAt > bPinnedAt ? -1 : 1;
  }
  return compareLibraryTitles(a, b, sort);
}

export function selectVisibleLibraryTitles<T extends SavedTitle>({
  items,
  pinnedAtById,
  query,
  sort,
  statusFilter,
  classificationFilter,
}: {
  items: readonly T[];
  pinnedAtById: ReadonlyMap<string, number>;
  query: string;
  sort: LibrarySort;
  statusFilter: LibraryStatusFilter;
  classificationFilter: LibraryClassificationFilter;
}): T[] {
  const needle = query.trim().toLocaleLowerCase("es");
  const matchingItems = items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (!matchesLibraryClassification(item, classificationFilter)) return false;
    if (!needle) return true;
    if (item.title.toLocaleLowerCase("es").includes(needle)) return true;
    return (item.tags ?? []).some((tag) =>
      tag.toLocaleLowerCase("es").includes(needle)
    );
  });

  const pinned: T[] = [];
  const unpinned: T[] = [];
  for (const item of matchingItems) {
    (pinnedAtById.has(item.id) ? pinned : unpinned).push(item);
  }
  pinned.sort((a, b) => comparePinnedLibraryTitles(a, b, pinnedAtById, sort));
  unpinned.sort((a, b) => compareLibraryTitles(a, b, sort));
  return [...pinned, ...unpinned];
}
