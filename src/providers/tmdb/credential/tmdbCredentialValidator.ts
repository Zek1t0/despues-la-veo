import { TmdbError } from "../tmdbErrors";
import { tmdbRequestWithToken } from "../tmdbTransport";
import type { TmdbCredentialValidator } from "./tmdbCredentialTypes";

type ExplicitTokenTransport = <T>(
  token: string,
  path: string,
  options?: Parameters<typeof tmdbRequestWithToken<T>>[2],
) => Promise<T>;

function parseAuthentication(value: unknown): true {
  if (typeof value !== "object" || value === null || !("success" in value) || value.success !== true) {
    throw new TmdbError("invalid-response");
  }
  return true;
}

export function createTmdbCredentialValidator(
  transport: ExplicitTokenTransport = tmdbRequestWithToken,
): TmdbCredentialValidator {
  return async (candidate) => {
    if (candidate.trim().length === 0) throw new TmdbError("credential-invalid");
    await transport(candidate, "/authentication", { method: "GET", parse: parseAuthentication });
  };
}
