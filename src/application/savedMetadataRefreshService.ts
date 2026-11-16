import type { RefreshResult } from "./metadataRefreshCoordinator";
export type SavedRefreshStatus = Readonly<{
    enabled: boolean;
    reason?: string;
    /** HTTP admission deadline only; never the automatic failure cooldown. */
    retryAt?: number;
    running: boolean;
    checkedAt: number | null;
}>;
export interface SavedMetadataRefreshService {
    inspect(id: string): Promise<SavedRefreshStatus>;
    refresh(id: string, signal: AbortSignal): Promise<RefreshResult>;
    subscribe(listener: (id: string) => void, id?: string): () => void;
    open?(id: string, signal: AbortSignal): Promise<RefreshResult | null>;
}
/** Lazy: importing the local detail cannot import credentials or perform provider requests. */
export async function getSavedMetadataRefreshService(): Promise<SavedMetadataRefreshService> {
    return (await import("./productMetadataRefresh")).getProductMetadataRefreshService();
}
