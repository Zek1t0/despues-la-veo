import { Platform } from "react-native";
import { MangaUpdatesError } from "./errors";
import { MANGAUPDATES_API_BASE, canonicalSeriesId } from "./identity";
import { MangaUpdatesRequestPolicy, MANGAUPDATES_REQUEST_POLICY, checkCancellation,
  mangaUpdatesRetryAfter, type MangaUpdatesTiming } from "./requestPolicy";
import { admittedType, mangaUpdatesSearchBody, parseDetailResponse, parseSearchResponse, type MangaUpdatesType } from "./validation";

export type MangaUpdatesClientOptions = Readonly<{
  fetchImplementation?: typeof fetch;
  timing?: MangaUpdatesTiming;
  /** Direct-development is for explicit non-browser diagnostics, not product activation. */
  platform?: "web" | "android" | "ios" | "direct-development";
  perPage?: number;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
}>;

export function createMangaUpdatesClient(options: MangaUpdatesClientOptions = {}) {
  const policy = new MangaUpdatesRequestPolicy(options.timing);
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const setTimer = options.setTimer ?? setTimeout, clearTimer = options.clearTimer ?? clearTimeout;
  const eligibleTransport = () => {
    // Diagnostic injection cannot override a real browser runtime.
    if (Platform.OS === "web" || options.platform === "web") throw new MangaUpdatesError("platform-unavailable");
  };

  async function attempt(path: string, body: ReturnType<typeof mangaUpdatesSearchBody> | undefined, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimer(() => { timedOut = true; controller.abort(); }, MANGAUPDATES_REQUEST_POLICY.timeoutMs);
    try {
      checkCancellation(signal);
      const response = await fetchImplementation(`${MANGAUPDATES_API_BASE}${path}`, {
        method: body ? "POST" : "GET", signal: controller.signal, redirect: "error",
        headers: body ? { Accept: "application/json", "Content-Type": "application/json" } : { Accept: "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        // No auth, cookies, Origin/User-Agent spoofing, or alternate/proxy origin.
      });
      if (response.url && new URL(response.url).origin !== MANGAUPDATES_API_BASE) {
        throw new MangaUpdatesError("access-rejected", response.status);
      }
      if (!response.ok) {
        const code = response.status === 403 || response.status === 401 ? "access-rejected" :
          response.status === 429 ? "rate-limited" : response.status === 404 ? "not-found" : "http";
        throw new MangaUpdatesError(code, response.status,
          response.status === 429 ? mangaUpdatesRetryAfter(response.headers.get("Retry-After"), policy.timing.now()) ?? undefined : undefined);
      }
      const text = await response.text();
      if (timedOut) throw new MangaUpdatesError("timeout");
      checkCancellation(signal);
      if (text.length > 1_000_000) throw new MangaUpdatesError("invalid-response");
      try { return JSON.parse(text) as unknown; }
      catch { throw new MangaUpdatesError("invalid-response"); }
    } catch (error) {
      if (timedOut) throw new MangaUpdatesError("timeout");
      if (signal?.aborted) throw new MangaUpdatesError("cancelled");
      if (error instanceof MangaUpdatesError) throw error;
      throw new MangaUpdatesError("network");
    } finally {
      clearTimer(timer); signal?.removeEventListener("abort", abort);
    }
  }

  async function request(path: string, body: ReturnType<typeof mangaUpdatesSearchBody> | undefined, signal?: AbortSignal): Promise<unknown> {
    for (let retry = 0; ; retry++) {
      // Local cooldown errors surface immediately; only a real HTTP 429 is retried.
      await policy.beforeRequest(signal);
      try { return await attempt(path, body, signal); }
      catch (error) {
        if (!(error instanceof MangaUpdatesError) || error.code !== "rate-limited" || error.status !== 429) throw error;
        const delay = error.retryAfterMs ?? MANGAUPDATES_REQUEST_POLICY.fallback429DelayMs;
        if (delay > MANGAUPDATES_REQUEST_POLICY.maximumAutomaticWaitMs || retry >= MANGAUPDATES_REQUEST_POLICY.automatic429Retries) {
          policy.blockFor(delay); throw error;
        }
        await policy.timing.wait(delay, signal);
      }
    }
  }

  return Object.freeze({
    async searchSeries(query: string, type: MangaUpdatesType, signal?: AbortSignal) {
      eligibleTransport(); checkCancellation(signal); admittedType(type);
      if (typeof query !== "string") throw new MangaUpdatesError("invalid-request");
      if (!query.trim()) return Object.freeze({ totalHits: 0, page: 1, perPage: options.perPage ?? 25, records: Object.freeze([]) });
      const body = mangaUpdatesSearchBody(query, type, options.perPage);
      return policy.cached(`search:${JSON.stringify(body)}`, "search", async () =>
        parseSearchResponse(await request("/v1/series/search", body, signal), type), signal);
    },
    async getSeries(id: string, selectedType?: MangaUpdatesType, signal?: AbortSignal) {
      eligibleTransport(); checkCancellation(signal); canonicalSeriesId(id);
      if (selectedType !== undefined) admittedType(selectedType);
      const record = await policy.cached(`detail:${id}`, "detail", async () =>
        parseDetailResponse(await request(`/v1/series/${id}`, undefined, signal), id), signal);
      if (selectedType !== undefined && record.type !== selectedType) throw new MangaUpdatesError("unsupported-type");
      return record;
    },
  });
}

export type MangaUpdatesClient = ReturnType<typeof createMangaUpdatesClient>;
let sharedClient: MangaUpdatesClient | undefined;
/** Lazy, provider-specific singleton: importing foundation code performs zero HTTP. */
export function getMangaUpdatesClient(): MangaUpdatesClient {
  return sharedClient ??= createMangaUpdatesClient();
}
