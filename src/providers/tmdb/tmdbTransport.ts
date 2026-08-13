import { TmdbError } from "./tmdbErrors";

export const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export type TmdbRequestOptions<T> = Readonly<{
  params?: Record<string, string>;
  signal?: AbortSignal;
  method?: "GET";
  parse?: (value: unknown) => T;
  fetchImplementation?: typeof fetch;
}>;

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

async function safeRemoteCode(response: Response): Promise<number | undefined> {
  try {
    const value: unknown = await response.json();
    if (
      typeof value === "object" && value !== null && "status_code" in value &&
      typeof value.status_code === "number" && Number.isFinite(value.status_code)
    ) return value.status_code;
  } catch {
    // El body remoto nunca se propaga ni se incorpora al error.
  }
  return undefined;
}

export async function tmdbRequestWithToken<T>(
  token: string,
  path: string,
  options: TmdbRequestOptions<T> = {},
): Promise<T> {
  if (token.length === 0) throw new TmdbError("credential-invalid");

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(options.params ?? {})) url.searchParams.set(key, value);

  let response: Response;
  try {
    response = await (options.fetchImplementation ?? fetch)(url.toString(), {
      method: options.method ?? "GET",
      signal: options.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json;charset=utf-8",
      },
    });
  } catch (error) {
    if (isAbortError(error)) throw new TmdbError("aborted");
    throw new TmdbError("network", { networkCause: "transport" });
  }

  if (!response.ok) {
    const remoteCode = await safeRemoteCode(response);
    if (response.status === 401) throw new TmdbError("credential-invalid", { status: 401, remoteCode });
    if (response.status === 429) throw new TmdbError("rate-limited", { status: 429, remoteCode });
    throw new TmdbError("http", { status: response.status, remoteCode });
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new TmdbError("invalid-response");
  }
  if (!options.parse) return value as T;
  try {
    return options.parse(value);
  } catch {
    throw new TmdbError("invalid-response");
  }
}

