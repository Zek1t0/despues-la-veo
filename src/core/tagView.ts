import type { SavedTitle } from "./savedTitle";

const SPANISH_COLLATOR = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

function compareExactSpanish(a: string, b: string): number {
  const localeResult =
    SPANISH_COLLATOR.compare(a, b) ||
    a.localeCompare(b, "es", { sensitivity: "variant" });
  if (localeResult !== 0) return localeResult;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareTagTitles(a: SavedTitle, b: SavedTitle): number {
  return (
    b.updatedAt - a.updatedAt ||
    compareExactSpanish(a.title, b.title) ||
    a.id.localeCompare(b.id)
  );
}

export function selectVisibleTagTitles(
  tagItems: readonly SavedTitle[],
  pinnedAtById: ReadonlyMap<string, number>
): SavedTitle[] {
  const pinned: SavedTitle[] = [];
  const unpinned: SavedTitle[] = [];
  for (const item of tagItems) {
    (pinnedAtById.has(item.id) ? pinned : unpinned).push(item);
  }
  pinned.sort((a, b) => {
    const aPinnedAt = pinnedAtById.get(a.id);
    const bPinnedAt = pinnedAtById.get(b.id);
    if (aPinnedAt !== undefined && bPinnedAt !== undefined && aPinnedAt !== bPinnedAt) {
      return aPinnedAt > bPinnedAt ? -1 : 1;
    }
    return compareTagTitles(a, b);
  });
  unpinned.sort(compareTagTitles);
  return [...pinned, ...unpinned];
}
