export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  control: 12,
  card: 16,
  panel: 20,
  round: 999,
} as const;

export const type = {
  caption: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
  control: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
  title: { fontSize: 16, lineHeight: 21, fontWeight: "700" },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
} as const;

export const controlTarget = 44;
export const pressedFeedback = { opacity: 0.8 } as const;

/** FlatList joins grid item keys with colons. Keep that delimiter out of each key. */
export function gridItemKey(identity: string): string {
  return JSON.stringify(identity).replace(/:/g, "\\u003a");
}

export function titleGridColumns(width: number, gap: number, fontScale: number): number {
  const minimumCardWidth = 150 * Math.max(1, fontScale);
  return Math.max(1, Math.min(6, Math.floor((width + gap) / (minimumCardWidth + gap))));
}
