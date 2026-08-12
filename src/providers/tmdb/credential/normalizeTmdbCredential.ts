import { TmdbError } from "../tmdbErrors";

const BEARER_PREFIX = /^Bearer\s+/;

export function normalizeTmdbCredential(candidate: string): string {
  const trimmed = candidate.trim();
  return trimmed.replace(BEARER_PREFIX, "").trim();
}

export function requireNormalizedTmdbCredential(candidate: string): string {
  const normalized = normalizeTmdbCredential(candidate);
  if (normalized.length === 0) {
    throw new TmdbError("credential-invalid");
  }
  return normalized;
}
