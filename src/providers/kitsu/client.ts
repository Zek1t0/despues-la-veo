import { KITSU_API_BASE, KITSU_DEVELOPMENT_API_BASE, canonicalAnimeId } from "./identity";
import { KitsuError } from "./errors";
import { parseAnimeDetail, parseAnimeSearch } from "./validation";

/** Engineering limits, not published quotas. No cache/retention before gate M. */
export const KITSU_REQUEST_POLICY = Object.freeze({ spacingMs: 1000, timeoutMs: 15000, queuedRequests: 16, pageSize: 20 });
export const checkKitsuCancellation = (signal?: AbortSignal) => { if (signal?.aborted) throw new KitsuError("cancelled"); };
export function waitForKitsu(ms: number, signal?: AbortSignal): Promise<void> {
  checkKitsuCancellation(signal);
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(new KitsuError("cancelled")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
export function kitsuRetryAfter(value: string | null, now: number): number | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  if (/^[0-9]+$/.test(raw)) {
    const ms = Number(raw) * 1000;
    return Number.isSafeInteger(ms) && ms <= Number.MAX_SAFE_INTEGER - now ? ms : null;
  }
  if (!/^[A-Za-z]{3}, [0-9]{2} [A-Za-z]{3} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT$/.test(raw)) return null;
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}
export type KitsuTiming = Readonly<{ now(): number; wait: typeof waitForKitsu }>;
export type KitsuClientOptions = Readonly<{
  /** Explicit injection only; product wrappers own real network access and its gates. */
  fetchImplementation: typeof fetch;
  /** Explicit official endpoint for local live use; no arbitrary host or fallback. */
  apiBase?: typeof KITSU_DEVELOPMENT_API_BASE;
  timing?: KitsuTiming; setTimer?: typeof setTimeout; clearTimer?: typeof clearTimeout;
}>;
export function createKitsuClient(options: KitsuClientOptions) {
  const apiBase = options.apiBase ?? KITSU_API_BASE;
  const timing = options.timing ?? { now: Date.now, wait: waitForKitsu };
  const setTimer = options.setTimer ?? setTimeout, clearTimer = options.clearTimer ?? clearTimeout;
  let tail: Promise<unknown> = Promise.resolve(), pending = 0, nextStart = 0, blockedUntil = 0;
  const fields = "canonicalTitle,titles,subtype,startDate,synopsis,categories";
  const metadata = { "fields[anime]": fields, include: "categories", "fields[categories]": "title" };
  async function attempt(path: string, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    let rejectAbort: (reason: KitsuError) => void = () => {};
    const interrupted = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const abort = () => { controller.abort(); rejectAbort(new KitsuError("cancelled")); };
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimer(() => { timedOut = true; controller.abort(); rejectAbort(new KitsuError("timeout")); }, KITSU_REQUEST_POLICY.timeoutMs);
    const perform = async () => {
      checkKitsuCancellation(signal);
      const response = await options.fetchImplementation(`${apiBase}${path}`, {
        method: "GET", headers: { Accept: "application/vnd.api+json" }, signal: controller.signal,
        credentials: "omit", redirect: "error",
      });
      checkKitsuCancellation(controller.signal);
      if (response.redirected || (response.url && new URL(response.url).origin !== new URL(apiBase).origin)) throw new KitsuError("access-rejected");
      if (!response.ok) {
        if (response.status === 429) {
          const delay = kitsuRetryAfter(response.headers.get("Retry-After"), timing.now());
          // Missing/invalid/overflowing waits fail closed; never invent a shorter retry.
          blockedUntil = delay === null ? Infinity : Math.max(blockedUntil, timing.now() + delay);
          throw new KitsuError("rate-limited", delay ?? undefined);
        }
        throw new KitsuError(response.status === 404 ? "not-found" : response.status === 401 || response.status === 403 ? "access-rejected" : "server");
      }
      const text = await response.text();
      checkKitsuCancellation(controller.signal);
      if (text.length > 1_000_000) throw new KitsuError("invalid-response");
      try { return JSON.parse(text) as unknown; } catch { throw new KitsuError("invalid-response"); }
    };
    try {
      const value = await Promise.race([perform(), interrupted]);
      checkKitsuCancellation(signal);
      if (timedOut) throw new KitsuError("timeout");
      return value;
    } catch (error) {
      if (timedOut) throw new KitsuError("timeout");
      checkKitsuCancellation(signal);
      if (error instanceof KitsuError) throw error;
      throw new KitsuError("network");
    } finally { clearTimer(timer); signal?.removeEventListener("abort", abort); }
  }
  function request<T>(path: string, parse: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
    checkKitsuCancellation(signal);
    if (pending >= KITSU_REQUEST_POLICY.queuedRequests) return Promise.reject(new KitsuError("rate-limited"));
    pending++;
    const result = tail.then(async () => {
      checkKitsuCancellation(signal);
      if (blockedUntil > timing.now()) throw new KitsuError("rate-limited", Number.isFinite(blockedUntil) ? blockedUntil - timing.now() : undefined);
      if (nextStart > timing.now()) await timing.wait(nextStart - timing.now(), signal);
      checkKitsuCancellation(signal);
      nextStart = timing.now() + KITSU_REQUEST_POLICY.spacingMs;
      return parse(await attempt(path, signal));
    }).finally(() => { pending--; });
    tail = result.catch(() => undefined);
    return result;
  }
  return Object.freeze({
    async searchAnime(query: string, offset = 0, signal?: AbortSignal) {
      checkKitsuCancellation(signal);
      if (typeof query !== "string" || query.length > 1000 || !Number.isSafeInteger(offset) || offset < 0) throw new KitsuError("invalid-request");
      if (!query.trim()) return [];
      // Construct pagination locally. Never follow response links to arbitrary origins.
      const params = new URLSearchParams({ "filter[text]": query.trim(), "page[limit]": "20", "page[offset]": String(offset), ...metadata });
      return request(`/anime?${params}`, parseAnimeSearch, signal);
    },
    async getAnime(id: string, signal?: AbortSignal) {
      canonicalAnimeId(id);
      return request(`/anime/${id}?${new URLSearchParams(metadata)}`, value => parseAnimeDetail(value, id), signal);
    },
  });
}
export type KitsuClient = ReturnType<typeof createKitsuClient>;
