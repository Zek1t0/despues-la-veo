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
export const RUN_RETENTION_MS = 30 * 86400000;
export async function pruneMetadataRunsWithDb(db: Pick<RefreshDatabase,"runAsync">, now=Date.now(), protectedId="") {
    await db.runAsync("DELETE FROM library_update_runs WHERE state!='running' AND id!=? AND COALESCE(finished_at,started_at)<?;",protectedId,now-RUN_RETENTION_MS);
    await db.runAsync("DELETE FROM library_update_runs WHERE id IN (SELECT id FROM library_update_runs WHERE state!='running' AND id!=? ORDER BY COALESCE(finished_at,started_at) DESC,id DESC LIMIT -1 OFFSET ?);",protectedId,protectedId?19:20);
}
export function createMetadataRunRepository(db: RefreshDatabase, now:()=>number=Date.now) {
    return {
        save: (run: MetadataRunSummary) => runSerializedStorageMutation(async () => {
            await db.withTransactionAsync(async () => {
                await db.runAsync(`INSERT INTO library_update_runs (id,started_at,finished_at,state,counters_json,errors_json) VALUES (?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET finished_at=excluded.finished_at,state=excluded.state,counters_json=excluded.counters_json,errors_json=excluded.errors_json;`, run.id, run.startedAt, run.finishedAt, run.state, JSON.stringify(run.counters), JSON.stringify(run.errors.slice(0, 100)));
                await pruneMetadataRunsWithDb(db,now(),run.state==="running"?"":run.id);
            });
        }),
        lastCompleted: () => runSerializedStorageMutation(async () => {
            await pruneMetadataRunsWithDb(db,now());
            return db.getFirstAsync<{finished_at:number;started_at:number;id:string}>("SELECT id,started_at,finished_at FROM library_update_runs WHERE state='completed' ORDER BY finished_at DESC,id DESC LIMIT 1;");
        }),
        latest: () => runSerializedStorageMutation(async (): Promise<MetadataRunSummary | null> => {
            await pruneMetadataRunsWithDb(db,now());
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
                    throw new Error("Contadores de revisión inválidos.");
                const terminal=counters.changed+counters.unchanged+counters.skipped+counters.failed+counters.cancelled;
                if(counters.processed!==terminal||counters.processed+counters.pending!==counters.total) throw new Error("Contadores de revisión inconsistentes.");
                if(!counters.omissions||typeof counters.omissions!=="object"||Array.isArray(counters.omissions)||!Object.values(counters.omissions).every(n=>Number.isSafeInteger(n)&&n>=0)) throw new Error("Motivos de omisión inválidos.");
                return { id: row.id, startedAt: row.started_at, finishedAt: row.finished_at, state: row.state, counters, errors: Array.isArray(errors) ? errors.slice(0, 100).map(error => ({ code: typeof error?.code === "string" ? error.code.slice(0, 40) : "unknown" })) : [] };
            }
            catch {
                throw new Error("No se pudo interpretar el resumen de revisión.");
            }
        }),
    };
}
export type MetadataRunRepository = ReturnType<typeof createMetadataRunRepository>;
