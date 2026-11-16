import { activeMetadataDocument } from "../core/mediaMetadataState";
import type { PortableMediaPreferences } from "../core/mediaPreferences";
import { providerReferenceKey } from "../core/providerReference";
import { AUTOMATIC_FAILURE_COOLDOWN_MS, type MetadataRefreshCoordinator, type RefreshResult } from "./metadataRefreshCoordinator";
import { metadataIsStale } from "../core/metadataFreshness";
export { metadataIsStale, METADATA_DAY_MS } from "../core/metadataFreshness";
export function createAutomaticMetadataRefresh(deps: {
    coordinator: MetadataRefreshCoordinator;
    preferences(): Promise<PortableMediaPreferences>;
    now?: () => number;
    monotonicNow?: () => number;
}) {
    const now = deps.now ?? Date.now;
    const monotonicNow = deps.monotonicNow ?? (() => typeof performance === "undefined" ? Date.now() : performance.now());
    const localCooldowns = new Map<string, number>();
    const failures = new Map<string, {
        stamp: string;
        until: number;
    }>();
    return async function open(id: string, signal: AbortSignal): Promise<RefreshResult | null> {
        if (signal.aborted)
            return null;
        const preferences = await deps.preferences();
        if (!preferences.value.autoRefresh.enabled || signal.aborted)
            return null;
        const state = await deps.coordinator.inspect(id);
        if (!state.enabled || !("item" in state) || !state.item || !state.reference || signal.aborted)
            return null;
        const referenceKey = providerReferenceKey(state.reference);
        const key = JSON.stringify([id, referenceKey]);
        if ((localCooldowns.get(key) ?? 0) > monotonicNow()) return null;
        const checkedAt = state.item.metadataState ? activeMetadataDocument(state.item.metadataState)?.metadata.provenance.checkedAt : null;
        if (!metadataIsStale(checkedAt, preferences.value.autoRefresh.intervalDays, now()))
            return null;
        const operational = "operational" in state ? state.operational : undefined;
        if (operational?.errorCode?.startsWith("auto/")) {
            // Completion time travels in the existing operational error field, not in the document.
            // Legacy markers fall back to the attempt clock. Future clocks anchor once per runtime.
            const stamp = operational.errorCode, suffix = Number(stamp.split("@")[1]);
            const failedAt = Number.isSafeInteger(suffix) && suffix >= 0 ? suffix : operational.lastAttemptAt;
            let anchor = failures.get(key);
            if (!anchor || anchor.stamp !== stamp) {
                const age = failedAt === null ? 0 : Math.max(0, now() - failedAt);
                anchor = { stamp, until: monotonicNow() + Math.max(0, AUTOMATIC_FAILURE_COOLDOWN_MS - age) };
                failures.set(key, anchor);
            }
            if (monotonicNow() < anchor.until)
                return null;
        }
        else
            failures.delete(key);
        const result = await deps.coordinator.refresh(id, { signal, automatic: true, automaticIntervalDays: preferences.value.autoRefresh.intervalDays, expectedSource: `${referenceKey}@${state.item.metadataState?.selection.updatedAt ?? 0}` });
        // A failure to persist the operational marker must not create an HTTP retry loop.
        if (result.status === "failed") localCooldowns.set(key, monotonicNow() + AUTOMATIC_FAILURE_COOLDOWN_MS);
        else if (result.status === "changed" || result.status === "unchanged") localCooldowns.delete(key);
        return result;
    };
}
