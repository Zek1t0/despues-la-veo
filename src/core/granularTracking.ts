import type { MediaClassification } from "./mediaClassification";
import { parseProgressPosition, progressEligibility, type ProgressPosition } from "./personalProgress";

export function granularUuid(value: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)) throw new Error("UUID granular inválido.");
  return value;
}

export function granularCompatible(classification: MediaClassification, position: ProgressPosition, enabled: boolean): boolean {
  const eligibility = progressEligibility(classification);
  if (classification.medium === "literature") return enabled && (position.mode === "chapter" || position.mode === "special");
  if (eligibility === "none" || (eligibility === "explicit" && !enabled)) return false;
  return position.mode === "special" || (position.mode === "chapter" ? classification.medium === "comic" : classification.medium === "audiovisual");
}

export function granularOrder(position: ProgressPosition): [number, number, number, string] {
  const p = parseProgressPosition(position);
  if (!p) throw new Error("La unidad requiere una coordenada.");
  switch (p.mode) {
    case "episode": return [0, 0, p.episode, "000000"];
    case "season-episode": return [1, p.season, p.episode, "000000"];
    case "chapter": {
      const [whole, fraction = ""] = p.chapter.split(".");
      return [2, 0, parseInt(whole, 10), fraction.padEnd(6, "0")];
    }
    case "special": return [3, 0, 0, "000000"];
  }
}

export function civilConsumptionDate(value: string | null, now?: Date): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) throw new Error("Fecha de consumo inválida.");
  const date = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error("Fecha de consumo inválida.");
  if (now) {
    const today = [String(now.getFullYear()).padStart(4, "0"), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    if (value > today) throw new Error("La fecha de consumo no puede ser futura.");
  }
  return value;
}
