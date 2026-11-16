import type { MetadataRefreshCoordinator } from "./metadataRefreshCoordinator";
import type { MetadataRefreshRepository } from "../storage/metadataRefreshRepo";
import type { MetadataRunRepository, MetadataRunSummary } from "../storage/metadataRunRepo";
import { generateManualEntryIdentity } from "../core/manualEntryIdentity";
export type MetadataRunHandle = {
    done: Promise<MetadataRunSummary>;
    cancel(): void;
    getSnapshot(): MetadataRunSummary & {
        capturing: boolean;
    };
};
const copy = (run: MetadataRunSummary): MetadataRunSummary => ({ ...run, counters: { ...run.counters, omissions: { ...run.counters.omissions } }, errors: run.errors.map(error => ({ ...error })) });
export function createMetadataRunManager(deps: {
    coordinator: MetadataRefreshCoordinator;
    repository: MetadataRefreshRepository;
    runs: MetadataRunRepository;
    now?: () => number;
    id?: () => string;
}) {
    const now = deps.now ?? Date.now, listeners = new Set<(run: MetadataRunSummary) => void>();
    let active: MetadataRunHandle | null = null;
    function start(): MetadataRunHandle {
        if (active)
            return active;
        const controller = new AbortController();
        let capturing = true;
        const run: MetadataRunSummary = { id: (deps.id ?? generateManualEntryIdentity)(), startedAt: now(), finishedAt: null, state: "running", counters: { total: 0, processed: 0, changed: 0, unchanged: 0, skipped: 0, failed: 0, cancelled: 0, pending: 0, omissions: {} }, errors: [] };
        const publish = () => { for (const listener of listeners)
            try {
                listener(copy(run));
            }
            catch { } };
        const handle: MetadataRunHandle = { cancel: () => controller.abort(), getSnapshot: () => ({ ...copy(run), capturing }), done: Promise.resolve(run) };
        active = handle;
        handle.done = Promise.resolve().then(async () => {
            try {
                const ids = await deps.repository.ids();
                capturing = false;
                run.counters.total = ids.length;
                run.counters.pending = ids.length;
                await deps.runs.save(run);
                publish();
                for (const id of ids) {
                    if (controller.signal.aborted)
                        break;
                    const result = await deps.coordinator.refresh(id, { signal: controller.signal });
                    run.counters[result.status]++;
                    run.counters.processed++;
                    run.counters.pending--;
                    if (result.status === "failed" && run.errors.length < 100)
                        run.errors = [...run.errors, { code: result.code ?? "unknown" }];
                    if (result.status === "skipped") {
                        const reason = result.reason ?? "unavailable";
                        const category = reason.includes("manual") ? "manual" : reason.includes("credencial") ? "credential" : reason.includes("Elegí") ? "ambiguous" : reason.includes("no existe") ? "deleted" : reason.includes("conexión") ? "offline" : reason.includes("descartada") ? "obsolete" : "source-unavailable";
                        run.counters.omissions[category] = (run.counters.omissions[category] ?? 0) + 1;
                    }
                    await deps.runs.save(run);
                    publish();
                }
                if (controller.signal.aborted) {
                    run.counters.cancelled += run.counters.pending;
                    run.counters.processed += run.counters.pending;
                    run.counters.pending = 0;
                    run.state = "cancelled";
                }
                else
                    run.state = run.counters.failed || run.counters.skipped ? "partial" : "completed";
                run.finishedAt = now();
                await deps.runs.save(run);
                publish();
            }
            catch {
                run.state = "interrupted";
                run.finishedAt = now();
                run.errors = [...run.errors.slice(0, 99), { code: "persistence" }];
                try {
                    await deps.runs.save(run);
                }
                catch { }
                publish();
            }
            finally {
                if (active === handle)
                    active = null;
            }
            return copy(run);
        });
        return handle;
    }
    return { start, getActive: () => active, latest: deps.runs.latest, lastCompleted: deps.runs.lastCompleted, subscribe(listener: (run: MetadataRunSummary) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}

export type MetadataRunManager = ReturnType<typeof createMetadataRunManager>;
