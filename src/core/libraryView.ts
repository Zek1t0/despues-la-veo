import type { SavedTitle, TitleStatus, TitleType } from "./savedTitle";
import type { LibrarySort } from "./viewPreferences";

export type LibraryStatusFilter = "all" | TitleStatus;
export type LibraryTypeFilter = "all" | TitleType;

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

export function selectVisibleLibraryTitles({
  items,
  pinnedAtById,
  query,
  sort,
  statusFilter,
  typeFilter,
}: {
  items: readonly SavedTitle[];
  pinnedAtById: ReadonlyMap<string, number>;
  query: string;
  sort: LibrarySort;
  statusFilter: LibraryStatusFilter;
  typeFilter: LibraryTypeFilter;
}): SavedTitle[] {
  const needle = query.trim().toLocaleLowerCase("es");
  const matchingItems = items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (!needle) return true;
    if (item.title.toLocaleLowerCase("es").includes(needle)) return true;
    return (item.tags ?? []).some((tag) =>
      tag.toLocaleLowerCase("es").includes(needle)
    );
  });

  const pinned: SavedTitle[] = [];
  const unpinned: SavedTitle[] = [];
  for (const item of matchingItems) {
    (pinnedAtById.has(item.id) ? pinned : unpinned).push(item);
  }
  pinned.sort((a, b) => comparePinnedLibraryTitles(a, b, pinnedAtById, sort));
  unpinned.sort((a, b) => compareLibraryTitles(a, b, sort));
  return [...pinned, ...unpinned];
}
