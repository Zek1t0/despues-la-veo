export const LIBRARY_VIEW_MODES = ["detail", "grid"] as const;
export const SEARCH_VIEW_MODES = ["detail", "grid"] as const;
export const TAGS_VIEW_MODES = ["grid", "list"] as const;

export const LIBRARY_SORT_OPTIONS = [
  "updated-desc",
  "title-asc",
  "title-desc",
  "rating-desc",
  "personal-rating-desc",
  "personal-rating-asc",
  "year-desc",
] as const;

export const TAGS_SORT_OPTIONS = ["count-desc", "name-asc", "name-desc"] as const;

export type LibraryViewMode = (typeof LIBRARY_VIEW_MODES)[number];
export type SearchViewMode = (typeof SEARCH_VIEW_MODES)[number];
export type TagsViewMode = (typeof TAGS_VIEW_MODES)[number];
export type LibrarySort = (typeof LIBRARY_SORT_OPTIONS)[number];
export type TagsSort = (typeof TAGS_SORT_OPTIONS)[number];

export const VIEW_PREFERENCE_KEYS = {
  libraryViewMode: "library.viewMode",
  searchViewMode: "search.viewMode",
  tagsViewMode: "tags.viewMode",
  librarySort: "library.sort",
  tagsSort: "tags.sort",
} as const;

export type ViewPreferenceKey =
  (typeof VIEW_PREFERENCE_KEYS)[keyof typeof VIEW_PREFERENCE_KEYS];

export type ViewPreferenceValueByKey = {
  "library.viewMode": LibraryViewMode;
  "search.viewMode": SearchViewMode;
  "tags.viewMode": TagsViewMode;
  "library.sort": LibrarySort;
  "tags.sort": TagsSort;
};

export const VIEW_PREFERENCE_DEFAULTS = {
  "library.viewMode": "detail",
  "search.viewMode": "detail",
  "tags.viewMode": "grid",
  "library.sort": "updated-desc",
  "tags.sort": "count-desc",
} satisfies { [K in ViewPreferenceKey]: ViewPreferenceValueByKey[K] };

export function isLibraryViewMode(value: unknown): value is LibraryViewMode {
  return value === "detail" || value === "grid";
}

export function isSearchViewMode(value: unknown): value is SearchViewMode {
  return value === "detail" || value === "grid";
}

export function isTagsViewMode(value: unknown): value is TagsViewMode {
  return value === "grid" || value === "list";
}

export function isLibrarySort(value: unknown): value is LibrarySort {
  return (
    value === "updated-desc" ||
    value === "title-asc" ||
    value === "title-desc" ||
    value === "rating-desc" ||
    value === "personal-rating-desc" ||
    value === "personal-rating-asc" ||
    value === "year-desc"
  );
}

export function isTagsSort(value: unknown): value is TagsSort {
  return value === "count-desc" || value === "name-asc" || value === "name-desc";
}

export function parseViewPreference(
  key: "library.viewMode",
  value: unknown
): LibraryViewMode;
export function parseViewPreference(
  key: "search.viewMode",
  value: unknown
): SearchViewMode;
export function parseViewPreference(key: "tags.viewMode", value: unknown): TagsViewMode;
export function parseViewPreference(key: "library.sort", value: unknown): LibrarySort;
export function parseViewPreference(key: "tags.sort", value: unknown): TagsSort;
export function parseViewPreference(
  key: ViewPreferenceKey,
  value: unknown
): ViewPreferenceValueByKey[ViewPreferenceKey] {
  switch (key) {
    case "library.viewMode":
      return isLibraryViewMode(value) ? value : VIEW_PREFERENCE_DEFAULTS[key];
    case "search.viewMode":
      return isSearchViewMode(value) ? value : VIEW_PREFERENCE_DEFAULTS[key];
    case "tags.viewMode":
      return isTagsViewMode(value) ? value : VIEW_PREFERENCE_DEFAULTS[key];
    case "library.sort":
      return isLibrarySort(value) ? value : VIEW_PREFERENCE_DEFAULTS[key];
    case "tags.sort":
      return isTagsSort(value) ? value : VIEW_PREFERENCE_DEFAULTS[key];
  }
}
