import { TmdbError } from "./tmdbErrors";
import type { TmdbCredentialService } from "./credential/TmdbCredentialService";
import { tmdbCredentialService } from "./credential/tmdbCredentialRuntime";
import { tmdbRequestWithToken } from "./tmdbTransport";

type ExplicitTokenTransport = typeof tmdbRequestWithToken;

export function createTmdbClient(
  credentialService: Pick<TmdbCredentialService, "resolveToken">,
  transport: ExplicitTokenTransport = tmdbRequestWithToken,
  now: () => number = Date.now,
) {
  let blockedToken: string | undefined, blockedUntil = 0, blockedAccess = false;
  return async function tmdbFetch<T>(path: string, params?: Record<string, string>, signal?: AbortSignal): Promise<T> {
    const token = await credentialService.resolveToken();
    if (token === blockedToken && blockedUntil > now()) {
      throw new TmdbError(blockedAccess ? "credential-invalid" : "rate-limited", {
        status: blockedAccess ? 401 : 429,
        ...(Number.isFinite(blockedUntil) ? { retryAfterMs: blockedUntil - now() } : {}),
      });
    }
    try { return await transport<T>(token, path, { params, signal }); }
    catch (error) {
      if (error instanceof TmdbError && (error.kind === "rate-limited" || error.status === 401 || error.status === 403)) {
        blockedToken = token; blockedAccess = error.kind !== "rate-limited";
        blockedUntil = error.retryAfterMs === undefined ? Infinity : now() + error.retryAfterMs;
      }
      throw error;
    }
  };
}

export const tmdbFetch = createTmdbClient(tmdbCredentialService);
