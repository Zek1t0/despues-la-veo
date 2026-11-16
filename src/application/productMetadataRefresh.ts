import { getMediaPreferences } from "../storage/mediaPreferencesRepo";
import { createAutomaticMetadataRefresh } from "./automaticMetadataRefresh";
import { createMetadataRunRepository } from "../storage/metadataRunRepo";
import { createMetadataRunManager } from "./metadataRunManager";
import { Platform } from "react-native";
import { initDb } from "../storage/db";
import { createMetadataRefreshRepository } from "../storage/metadataRefreshRepo";
import { createMetadataRefreshCoordinator } from "./metadataRefreshCoordinator";
import { createTmdbRefreshCapability } from "../providers/tmdb/metadataRefresh";
import { createKitsuRefreshCapability } from "../providers/kitsu/metadataRefresh";
import { createMangaUpdatesRefreshCapability } from "../providers/mangaupdates/metadataRefresh";
import { tmdbCredentialService } from "../providers/tmdb/credential/tmdbCredentialRuntime";
import { tmdbFetch } from "../providers/tmdb/tmdbClient";
import { activeMetadataDocument } from "../core/mediaMetadataState";
import type { SavedMetadataRefreshService } from "./savedMetadataRefreshService";
let shared: Promise<{
    service: SavedMetadataRefreshService;
    coordinator: ReturnType<typeof createMetadataRefreshCoordinator>;
    repository: ReturnType<typeof createMetadataRefreshRepository>;
    runs: ReturnType<typeof createMetadataRunManager>;
}> | undefined;
export function getProductMetadataRefresh() {
    return shared ??= Promise.all([initDb(), tmdbCredentialService.initialize().catch(() => undefined)]).then(([db]) => {
        const repository = createMetadataRefreshRepository(db);
        const coordinator = createMetadataRefreshCoordinator({ repository, online: () => Platform.OS !== "web" || typeof navigator === "undefined" || navigator.onLine !== false, bindings: {
                tmdb: createTmdbRefreshCapability({ available: () => tmdbCredentialService.getSnapshot().status === "configured", generation: () => tmdbCredentialService.getSnapshot().generation,
                    load: (type, id, signal) => tmdbFetch(`/${type}/${id}`, { language: "es-AR" }, signal) }),
                kitsu: createKitsuRefreshCapability(() => Platform.OS), mangaupdates: createMangaUpdatesRefreshCapability(() => Platform.OS),
            } });
        const service: SavedMetadataRefreshService = {
            async inspect(id) { const state = await coordinator.inspect(id); return { enabled: state.enabled, reason: state.reason, retryAt: "retryAt" in state ? state.retryAt : undefined, running: coordinator.isRunning(id), checkedAt: "item" in state && state.item?.metadataState ? activeMetadataDocument(state.item.metadataState)?.metadata.provenance.checkedAt ?? null : null }; },
            refresh: (id, signal) => coordinator.refresh(id, { signal }),
            subscribe(listener, id) {
                const stop = coordinator.subscribe(listener);
                // Availability can change while the saved detail stays mounted. Re-read locally;
                // this never turns a connection/credential event into a new automatic opening.
                const changed = () => { if (id) listener(id); };
                const stopCredential = tmdbCredentialService.subscribe(changed);
                const browser = Platform.OS === "web" && typeof window !== "undefined" ? window : null;
                browser?.addEventListener("online", changed);
                browser?.addEventListener("offline", changed);
                return () => {
                    stop(); stopCredential();
                    browser?.removeEventListener("online", changed);
                    browser?.removeEventListener("offline", changed);
                };
            },
            open: createAutomaticMetadataRefresh({ coordinator, preferences: getMediaPreferences }),
        };
        const runs = createMetadataRunManager({ coordinator, repository, runs: createMetadataRunRepository(db) });
        return { service, coordinator, repository, runs };
    }).catch(error => { shared = undefined; throw error; });
}
export async function getProductMetadataRefreshService() { return (await getProductMetadataRefresh()).service; }
