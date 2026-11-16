import { metadataIsStale } from "../core/metadataFreshness";
import type { ProviderReference } from "../core/providerReference";
import { providerReferencesEqual } from "../core/providerReference";
import { legacyMetadataSnapshot, projectMediaMetadata, activeMetadataDocument } from "../core/mediaMetadataState";
import type { ProviderRefreshPayload } from "../providers/providerRefreshContracts";
import { refreshReference } from "../application/metadataRefreshBinding";
import { RefreshError } from "../application/metadataRefreshError";
import { beginMetadataRequestWithDb, updateMediaMetadataWithDb, type MetadataDb } from "./mediaMetadataRepo";
import { getSavedTitleWithReferencesByIdWithDb } from "./savedTitleStorage";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import { publishLibraryInvalidation } from "./libraryInvalidation";
export type RefreshDatabase = MetadataDb & {
    withTransactionAsync(task: () => Promise<void>): Promise<void>;
};
export type RefreshCapture = Readonly<{
    id: string;
    reference: ProviderReference;
    selectionAt: number;
    createdAt: number;
    generation: number;
}>;
export type RefreshOperational = Readonly<{
    lastAttemptAt: number | null;
    backoffUntil: number | null;
    errorCode: string | null;
}>;
export const checkRefreshSignal = (signal: AbortSignal) => { if (signal.aborted)
    throw new RefreshError("cancelled"); };
export function createMetadataRefreshRepository(db: RefreshDatabase) {
    const item = (id: string) => getSavedTitleWithReferencesByIdWithDb(db, id);
    const compatible = async (c: Omit<RefreshCapture, "generation">) => {
        const current = await item(c.id), ref = current && refreshReference(current);
        return current && ref && providerReferencesEqual(ref, c.reference) && current.createdAt === c.createdAt && (current.metadataState?.selection.updatedAt ?? 0) === c.selectionAt ? current : null;
    };
    return {
        read: (id: string) => runSerializedStorageMutation(() => item(id)),
        ids: () => runSerializedStorageMutation(async () => (await db.getAllAsync<{
            id: string;
        }>("SELECT id FROM saved_titles ORDER BY id;")).map(row => row.id)),
        // Retry-After belongs to the source, including after a process restart.
        providerBackoff: (provider: string) => runSerializedStorageMutation(async () => {
            const row = await db.getFirstAsync<{ until: number | null }>(
                "SELECT MAX(backoff_until) AS until FROM media_refresh_state WHERE provider=? AND (error_code LIKE '%/rate-limited@%' OR error_code LIKE '%/rate-limited');", provider);
            return row?.until ?? null;
        }),
        operational: (id: string, ref: ProviderReference) => runSerializedStorageMutation(async (): Promise<RefreshOperational> => {
            const row = await db.getFirstAsync<{
                last_attempt_at: number | null;
                backoff_until: number | null;
                error_code: string | null;
            }>("SELECT last_attempt_at,backoff_until,error_code FROM media_refresh_state WHERE saved_title_id=? AND provider=? AND resource_namespace=? AND external_id=?;", id, ref.provider, ref.resourceNamespace, ref.externalId);
            return { lastAttemptAt: row?.last_attempt_at ?? null, backoffUntil: row?.backoff_until ?? null, errorCode: row?.error_code ?? null };
        }),
        begin: (capture: Omit<RefreshCapture, "generation">, now: number, signal: AbortSignal, automaticIntervalDays?: number) => runSerializedStorageMutation(async () => {
            let result: RefreshCapture | null = null;
            await db.withTransactionAsync(async () => {
                checkRefreshSignal(signal);
                const current = await compatible(capture);
                if (!current) return;
                if (automaticIntervalDays !== undefined && !metadataIsStale(current.metadataState ? activeMetadataDocument(current.metadataState)?.metadata.provenance.checkedAt : null, automaticIntervalDays, now)) return;
                checkRefreshSignal(signal);
                const generation = await beginMetadataRequestWithDb(db, capture.id, capture.reference);
                await db.runAsync("UPDATE media_refresh_state SET last_attempt_at=? WHERE saved_title_id=? AND provider=? AND resource_namespace=? AND external_id=?;", now, capture.id, capture.reference.provider, capture.reference.resourceNamespace, capture.reference.externalId);
                checkRefreshSignal(signal);
                result = { ...capture, generation };
            });
            return result;
        }),
        commit: (capture: RefreshCapture, payload: ProviderRefreshPayload, now: number, signal: AbortSignal) => runSerializedStorageMutation(async () => {
            let result = { changed: false, discarded: true };
            await db.withTransactionAsync(async () => {
                checkRefreshSignal(signal);
                const current = await compatible(capture);
                if (!current)
                    return;
                if (!providerReferencesEqual(payload.metadata.provenance.reference, capture.reference))
                    throw new RefreshError("invalid-response");
                const metadata = { ...payload.metadata, provenance: { ...payload.metadata.provenance, fetchedAt: now, checkedAt: now } };
                const snapshot = payload.snapshotPatch ? { ...(current.metadataState ? activeMetadataDocument(current.metadataState)?.snapshot ?? projectMediaMetadata(current.metadataState) : legacyMetadataSnapshot(current)), ...payload.snapshotPatch } : undefined;
                result = await updateMediaMetadataWithDb(db, capture.id, metadata, now, capture.generation, undefined, snapshot);
                if (!result.discarded)
                    await db.runAsync("UPDATE media_refresh_state SET error_code=?,backoff_until=NULL WHERE saved_title_id=? AND provider=? AND resource_namespace=? AND external_id=? AND generation=?;", payload.diagnostics.length ? "partial" : null, capture.id, capture.reference.provider, capture.reference.resourceNamespace, capture.reference.externalId, capture.generation);
                checkRefreshSignal(signal);
            });
            if (result.changed)
                publishLibraryInvalidation([capture.id]);
            return result;
        }),
        fail: (capture: RefreshCapture, code: string, until: number | null) => runSerializedStorageMutation(async () => {
            await db.withTransactionAsync(async () => {
                if (!await compatible(capture))
                    return;
                await db.runAsync("UPDATE media_refresh_state SET error_code=?,backoff_until=? WHERE saved_title_id=? AND provider=? AND resource_namespace=? AND external_id=? AND generation=?;", code, until, capture.id, capture.reference.provider, capture.reference.resourceNamespace, capture.reference.externalId, capture.generation);
            });
        }),
    };
}
export type MetadataRefreshRepository = ReturnType<typeof createMetadataRefreshRepository>;
