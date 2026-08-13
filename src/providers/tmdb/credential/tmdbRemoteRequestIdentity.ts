import type { TmdbCredentialStatus } from "./tmdbCredentialTypes";

export type TmdbSearchObservation = Readonly<{
  rawQuery: string;
  debouncedQuery: string;
  status: TmdbCredentialStatus;
  generation: number;
  retry: number;
}>;

export function isTmdbSearchDebounceSettled(rawQuery: string, debouncedQuery: string): boolean {
  return rawQuery === debouncedQuery;
}

export function isTmdbSearchObservationEqual(
  previous: TmdbSearchObservation | null,
  current: TmdbSearchObservation,
): boolean {
  return previous !== null
    && previous.rawQuery === current.rawQuery
    && previous.debouncedQuery === current.debouncedQuery
    && previous.status === current.status
    && previous.generation === current.generation
    && previous.retry === current.retry;
}

export function shouldRunTmdbSearch(
  previous: TmdbSearchObservation | null,
  current: TmdbSearchObservation,
): boolean {
  if (!current.rawQuery || !isTmdbSearchDebounceSettled(current.rawQuery, current.debouncedQuery) || current.status !== "configured") return false;
  if (previous === null) return true;
  if (!isTmdbSearchDebounceSettled(previous.rawQuery, previous.debouncedQuery)) return true;
  if (current.debouncedQuery !== previous.debouncedQuery || current.retry !== previous.retry) return true;
  if (previous.status !== "configured") return true;
  return current.generation > previous.generation;
}

export function isTmdbDetailLoadingVisible(input: Readonly<{
  validRoute: boolean;
  status: TmdbCredentialStatus;
  hasCurrentData: boolean;
  hasCurrentError: boolean;
}>): boolean {
  if (!input.validRoute) return false;
  if (input.status === "initializing") return true;
  return input.status === "configured" && !input.hasCurrentData && !input.hasCurrentError;
}

export type TmdbRemoteRequestIdentity = Readonly<{
  sequence: number;
  resource: string;
  generation: number;
}>;

export function sameTmdbRemoteRequest(
  expected: TmdbRemoteRequestIdentity,
  current: TmdbRemoteRequestIdentity,
): boolean {
  return expected.sequence === current.sequence
    && expected.resource === current.resource
    && expected.generation === current.generation;
}
