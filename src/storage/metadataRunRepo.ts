import type { RefreshDatabase } from "./metadataRefreshRepo";
import { runSerializedStorageMutation } from "./storageMutationQueue";
export type MetadataRunCounters = {
    total: number;
    processed: number;
    changed: number;
    unchanged: number;
    skipped: number;
    failed: number;
    cancelled: number;
    pending: number;
    omissions: Record<string, number>;
};
export type MetadataRunSummary = {
    id: string;
    startedAt: number;
    finishedAt: number | null;
    state: "running" | "completed" | "partial" | "cancelled" | "interrupted";
    counters: MetadataRunCounters;
    errors: readonly {
        code: string;
    }[];
};
/** Bootstrap only: does not start/restart work or change confirmed item metadata. */
export async function recoverInterruptedMetadataRunsWithDb(db: Pick<RefreshDatabase, "runAsync">, now = Date.now()): Promise<void> {
    await db.runAsync("UPDATE library_update_runs SET state='interrupted',finished_at=? WHERE state='running';", now);
}
export function createMetadataRunRepository(db: RefreshDatabase) {
    return {
        save: (run: MetadataRunSummary) => runSerializedStorageMutation(async () => {
            await db.withTransactionAsync(async () => {
                await db.runAsync(`INSERT INTO library_update_runs (id,started_at,finished_at,state,counters_json,errors_json) VALUES (?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET finished_at=excluded.finished_at,state=excluded.state,counters_json=excluded.counters_json,errors_json=excluded.errors_json;`, run.id, run.startedAt, run.finishedAt, run.state, JSON.stringify(run.counters), JSON.stringify(run.errors.slice(0, 100)));
            });
        }),
        latest: () => runSerializedStorageMutation(async (): Promise<MetadataRunSummary | null> => {
            const row = await db.getFirstAsync<{
                id: string;
                started_at: number;
                finished_at: number | null;
                state: MetadataRunSummary["state"];
                counters_json: string;
                errors_json: string;
            }>("SELECT * FROM library_update_runs ORDER BY started_at DESC,id DESC LIMIT 1;");
            if (!row)
                return null;
            try {
                const counters = JSON.parse(row.counters_json) as MetadataRunCounters, errors = JSON.parse(row.errors_json);
                if (![counters.total, counters.processed, counters.changed, counters.unchanged, counters.skipped, counters.failed, counters.cancelled, counters.pending].every(n => Number.isSafeInteger(n) && n >= 0))
                    return null;
                return { id: row.id, startedAt: row.started_at, finishedAt: row.finished_at, state: row.state, counters, errors: Array.isArray(errors) ? errors.slice(0, 100).map(error => ({ code: typeof error?.code === "string" ? error.code.slice(0, 40) : "unknown" })) : [] };
            }
            catch {
                return null;
            }
        }),
    };
}
export type MetadataRunRepository = ReturnType<typeof createMetadataRunRepository>;
