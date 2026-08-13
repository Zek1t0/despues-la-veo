import type { TmdbCredentialService } from "./credential/TmdbCredentialService";
import { tmdbCredentialService } from "./credential/tmdbCredentialRuntime";
import { tmdbRequestWithToken } from "./tmdbTransport";

type ExplicitTokenTransport = typeof tmdbRequestWithToken;

export function createTmdbClient(
  credentialService: Pick<TmdbCredentialService, "resolveToken">,
  transport: ExplicitTokenTransport = tmdbRequestWithToken,
) {
  return async function tmdbFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
    const token = await credentialService.resolveToken();
    return transport<T>(token, path, { params });
  };
}

export const tmdbFetch = createTmdbClient(tmdbCredentialService);
