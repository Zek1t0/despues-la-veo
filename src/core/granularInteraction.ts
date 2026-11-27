export function requestGeneration() {
  let version = 0;
  return {
    begin: () => ++version,
    invalidate: () => { version++; },
    current: (ticket: number) => ticket === version,
  };
}

export function readKey<T>(expected: string, value: { key: string; data: T } | null): T | null {
  return value?.key === expected ? value.data : null;
}

export type ConsumptionDateMode = "none" | "today" | "date" | "clear";
export function consumptionIntent(marked: boolean, mode: ConsumptionDateMode, previous: { marked?: number; consumed_on?: string | null },
  today: string, date: string): string | null {
  if (!marked || mode === "clear") return null;
  if (mode === "today") return today;
  if (mode === "date") return date;
  return previous.marked === 1 ? previous.consumed_on ?? null : null;
}

export function selectionUnitLabel(coordinate: string, group: string, id?: string) {
  return id?`${coordinate} · ${group} · ${id}`:`${coordinate} · ${group}`;
}
