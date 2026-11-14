import { metadataObject, metadataTimestamp } from "./metadataValidation";
export type MediaPreferences = Readonly<{ version: 1; languages: readonly string[]; autoRefresh: Readonly<{ enabled: boolean; intervalDays: number }>; hideSensitive: boolean }>;
export type PortableMediaPreferences = Readonly<{ value: MediaPreferences; updatedAt: number }>;
export const DEFAULT_MEDIA_PREFERENCES: MediaPreferences = Object.freeze({ version: 1, languages: Object.freeze(["es","en","ja-Latn"]),
  autoRefresh: Object.freeze({ enabled: true, intervalDays: 7 }), hideSensitive: false });
export function parseMediaPreferences(value: unknown): PortableMediaPreferences {
  if (!metadataObject(value) || !metadataTimestamp(value.updatedAt) || !metadataObject(value.value)) throw new Error("Preferencias de metadata inválidas.");
  const p = value.value;
  if (p.version !== 1 || !Array.isArray(p.languages) || !p.languages.length || p.languages.length > 16 ||
      !p.languages.every(locale => typeof locale === "string" && locale.length <= 100 && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) ||
      new Set(p.languages).size !== p.languages.length || typeof p.hideSensitive !== "boolean" || !metadataObject(p.autoRefresh) ||
      typeof p.autoRefresh.enabled !== "boolean" || typeof p.autoRefresh.intervalDays !== "number" ||
      !Number.isFinite(p.autoRefresh.intervalDays) || p.autoRefresh.intervalDays <= 0 || p.autoRefresh.intervalDays > 3650) throw new Error("Preferencias de metadata inválidas.");
  return { updatedAt: value.updatedAt, value: { version: 1, languages: [...p.languages], hideSensitive: p.hideSensitive,
    autoRefresh: { enabled: p.autoRefresh.enabled, intervalDays: p.autoRefresh.intervalDays } } };
}
