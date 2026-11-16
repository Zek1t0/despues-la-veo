export const METADATA_DAY_MS = 86400000;
/** Only a successful, non-future metadata clock establishes freshness. */
export function metadataIsStale(checkedAt: unknown, intervalDays: number, now: number): boolean {
    return typeof checkedAt !== "number" || !Number.isSafeInteger(checkedAt) || checkedAt < 0 || checkedAt > now || now - checkedAt >= intervalDays * METADATA_DAY_MS;
}
