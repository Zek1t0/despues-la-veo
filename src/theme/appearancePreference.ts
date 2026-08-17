import {
  APPEARANCE_PALETTE_IDS,
  APPEARANCE_PREFERENCE_VERSION,
  APPEARANCE_SCHEMES,
  type AppearancePreference,
} from "./types";

export const DEFAULT_APPEARANCE_PREFERENCE: AppearancePreference = Object.freeze({
  version: APPEARANCE_PREFERENCE_VERSION,
  scheme: "dark",
  palette: "original",
});

export type AppearanceParseResult =
  | Readonly<{ status: "valid"; preference: AppearancePreference }>
  | Readonly<{ status: "invalid" }>;

export type AppearanceReadResult =
  | Readonly<{ status: "absent" }>
  | Readonly<{ status: "valid"; preference: AppearancePreference; updatedAt: number }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{ status: "error"; error: unknown }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAppearancePayload(value: unknown): AppearanceParseResult {
  if (!isRecord(value)) return { status: "invalid" };
  const keys = Object.keys(value);
  if (keys.length !== 3 || !keys.includes("version") || !keys.includes("scheme") ||
      !keys.includes("palette")) {
    return { status: "invalid" };
  }
  if (value.version !== APPEARANCE_PREFERENCE_VERSION ||
      !APPEARANCE_SCHEMES.includes(value.scheme as never) ||
      !APPEARANCE_PALETTE_IDS.includes(value.palette as never)) {
    return { status: "invalid" };
  }
  return {
    status: "valid",
    preference: Object.freeze({
      version: APPEARANCE_PREFERENCE_VERSION,
      scheme: value.scheme as AppearancePreference["scheme"],
      palette: value.palette as AppearancePreference["palette"],
    }),
  };
}

export function parseSerializedAppearance(value: unknown): AppearanceParseResult {
  if (typeof value !== "string") return { status: "invalid" };
  try {
    return parseAppearancePayload(JSON.parse(value));
  } catch {
    return { status: "invalid" };
  }
}

export function serializeAppearancePreference(preference: AppearancePreference): string {
  const parsed = parseAppearancePayload(preference);
  if (parsed.status !== "valid") throw new Error("AppearancePreference inválida.");
  return JSON.stringify(parsed.preference);
}
