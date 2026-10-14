import { MangaUpdatesError } from "./errors";
import type { MangaUpdatesSearchResponse, MangaUpdatesSeries } from "./validation";

/** Engineering defaults, NOT published MangaUpdates quotas or TTLs. */
export const MANGAUPDATES_REQUEST_POLICY = Object.freeze({
  spacingMs: 1200, searchTtlMs: 60_000, detailTtlMs: 300_000,
  cacheEntries: 32, queuedRequests: 16, timeoutMs: 12_000,
  automatic429Retries: 1, fallback429DelayMs: 3000, maximumAutomaticWaitMs: 30_000,
});

export function checkCancellation(signal?: AbortSignal): void {
  if (signal?.aborted) throw new MangaUpdatesError("cancelled");
}

export function waitForMangaUpdates(ms: number, signal?: AbortSignal): Promise<void> {
  checkCancellation(signal);
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(new MangaUpdatesError("cancelled")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
export type MangaUpdatesTiming = Readonly<{ now: () => number; wait: typeof waitForMangaUpdates }>;
type CacheValue = MangaUpdatesSeries | MangaUpdatesSearchResponse;

/** One provider-local queue/cache per shared client, with injectable time for deterministic tests. */
export class MangaUpdatesRequestPolicy {
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private nextStart = 0;
  private blockedUntil = 0;
  private readonly cache = new Map<string, { expires: number; value: CacheValue }>();
  private readonly inFlight = new Map<string, Promise<CacheValue>>();
  constructor(readonly timing: MangaUpdatesTiming = { now: Date.now, wait: waitForMangaUpdates }) {}

  private get<T extends CacheValue>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    this.cache.delete(key);
    if (entry.expires <= this.timing.now()) return undefined;
    this.cache.set(key, entry);
    return entry.value as T; // Only the same validated endpoint/key stores this value.
  }

  cached<T extends CacheValue>(key: string, kind: "search" | "detail", load: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    checkCancellation(signal);
    const hit = this.get<T>(key);
    if (hit) return Promise.resolve(hit);
    if (!signal) {
      const pending = this.inFlight.get(key);
      if (pending) return pending as Promise<T>;
    }
    if (this.pending >= MANGAUPDATES_REQUEST_POLICY.queuedRequests) throw new MangaUpdatesError("rate-limited");
    this.pending++;
    const result = this.tail.then(async () => {
      checkCancellation(signal);
      const hit = this.get<T>(key);
      if (hit) return hit;
      const value = await load();
      checkCancellation(signal);
      this.cache.set(key, { value, expires: this.timing.now() +
        (kind === "search" ? MANGAUPDATES_REQUEST_POLICY.searchTtlMs : MANGAUPDATES_REQUEST_POLICY.detailTtlMs) });
      while (this.cache.size > MANGAUPDATES_REQUEST_POLICY.cacheEntries) {
        this.cache.delete(this.cache.keys().next().value!);
      }
      return value;
    }).finally(() => { this.pending--; });
    this.tail = result.catch(() => undefined); // Failure cannot poison subsequent queue entries.
    if (!signal) {
      this.inFlight.set(key, result);
      void result.finally(() => { if (this.inFlight.get(key) === result) this.inFlight.delete(key); }).catch(() => undefined);
    }
    return result;
  }

  async beforeRequest(signal?: AbortSignal): Promise<void> {
    checkCancellation(signal);
    if (this.blockedUntil > this.timing.now()) {
      throw new MangaUpdatesError("rate-limited", 429, this.blockedUntil - this.timing.now());
    }
    const delay = this.nextStart - this.timing.now();
    if (delay > 0) await this.timing.wait(delay, signal);
    checkCancellation(signal);
    this.nextStart = this.timing.now() + MANGAUPDATES_REQUEST_POLICY.spacingMs;
  }

  blockFor(ms: number): void { this.blockedUntil = Math.max(this.blockedUntil, this.timing.now() + ms); }
}

export function mangaUpdatesRetryAfter(value: string | null, now: number): number | null {
  if (value === null || !value.trim()) return null;
  if (/^[0-9]+(?:\.[0-9]+)?$/.test(value.trim())) {
    const ms = Math.ceil(parseFloat(value) * 1000);
    return Number.isSafeInteger(ms) ? ms : null;
  }
  if (!/^[A-Za-z]{3}, [0-9]{2} [A-Za-z]{3} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT$/.test(value.trim())) return null;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}
