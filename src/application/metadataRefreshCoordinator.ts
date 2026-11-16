import { activeMetadataDocument } from "../core/mediaMetadataState";
import { metadataIsStale } from "../core/metadataFreshness";
import { providerReferenceKey } from "../core/providerReference";
import type { ProviderRefreshPayload } from "../providers/providerRefreshContracts";
import type { MetadataRefreshRepository, RefreshCapture } from "../storage/metadataRefreshRepo";
import { resolveRefreshCapability, type RefreshBindings } from "./metadataRefreshBinding";
import { RefreshError, refreshError } from "./metadataRefreshError";
export type RefreshResult = Readonly<{
    status: "changed" | "unchanged" | "skipped" | "failed" | "cancelled";
    reason?: string;
    code?: RefreshError["code"];
    checkedAt?: number;
    retryAt?: number;
    diagnostics?: ProviderRefreshPayload["diagnostics"];
}>;
export type RefreshOptions = Readonly<{
    signal?: AbortSignal;
    automatic?: boolean;
    automaticIntervalDays?: number;
    expectedSource?: string;
}>;
export const AUTOMATIC_FAILURE_COOLDOWN_MS = 15 * 60000;
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
        const stop = () => { signal.removeEventListener("abort", stop); reject(new RefreshError("cancelled")); };
        work.then(value => { signal.removeEventListener("abort", stop); resolve(value); }, error => { signal.removeEventListener("abort", stop); reject(error); });
        if (signal.aborted) { stop(); return; }
        signal.addEventListener("abort", stop, { once: true });
    });
}
export function createMetadataRefreshCoordinator(deps: {
    repository: MetadataRefreshRepository;
    bindings: RefreshBindings;
    now?: () => number;
    online?: () => boolean;
}) {
    const now = deps.now ?? Date.now, online = deps.online ?? (() => true), repo = deps.repository;
    type Flight = {
        controller: AbortController;
        selectionAt: number;
        scope: string;
        consumers: Set<object>;
        automatic: boolean;
        promise: Promise<RefreshResult>;
    };
    const flights = new Map<string, Flight>(), blocks = new Map<string, {
        scope: string;
        until: number;
    }>(), listeners = new Set<(id: string) => void>();
    const emit = (id: string) => { for (const listener of listeners)
        try {
            listener(id);
        }
        catch { } };
    // Only an existing, trustworthy HTTP deadline is exposed; automatic cooldown is separate.
    const retryDeadline = (until: number) => Number.isSafeInteger(until) && until >= 0 && until <= 8_640_000_000_000_000 ? until : undefined;
    async function inspect(id: string) {
        const item = await repo.read(id);
        if (!item)
            return { enabled: false, reason: "El título ya no existe." } as const;
        const resolved = resolveRefreshCapability(item, deps.bindings);
        if (!resolved.enabled || !resolved.reference || !resolved.capability)
            return { ...resolved, item };
        if (!online())
            return { ...resolved, item, enabled: false, reason: "Sin conexión disponible. Tu ficha local sigue accesible." };
        const scope = resolved.capability.scope(), block = blocks.get(resolved.reference.provider);
        const memoryBackoff = block?.scope === scope ? block.until : 0;
        if (memoryBackoff === Infinity)
            return { ...resolved, item, enabled: false, retryAt: undefined, reason: "Fuente suspendida por acceso rechazado o espera HTTP sin fecha conocida." };
        const providerBackoff = await repo.providerBackoff(resolved.reference.provider);
        const operational = await repo.operational(id, resolved.reference);
        const itemBackoff = operational.errorCode?.split("@")[0].endsWith("rate-limited") ? operational.backoffUntil ?? 0 : 0;
        const until = Math.max(memoryBackoff, providerBackoff ?? 0, itemBackoff);
        if (until > now())
            return { ...resolved, item, operational, enabled: false, retryAt: retryDeadline(until), reason: retryDeadline(until) === undefined
                ? "Fuente suspendida por espera HTTP sin fecha confiable."
                : "Esperá el plazo indicado por la fuente." };
        return { ...resolved, item, operational };
    }
    async function refresh(id: string, options: RefreshOptions = {}): Promise<RefreshResult> {
        if (options.signal?.aborted)
            return { status: "cancelled" };
        let state: Awaited<ReturnType<typeof inspect>>;
        try {
            state = await inspect(id);
        }
        catch {
            return { status: "failed", code: "persistence" };
        }
        if (!state.enabled || !("item" in state) || !state.item || !state.reference || !state.capability)
            return { status: "skipped", reason: state.reason };
        const item = state.item, reference = state.reference, capability = state.capability, scope = capability.scope();
        const key = JSON.stringify([id, providerReferenceKey(reference)]);
        if (options.expectedSource && options.expectedSource !== `${providerReferenceKey(reference)}@${item.metadataState?.selection.updatedAt ?? 0}`)
            return { status: "skipped", reason: "La fuente cambió durante la evaluación automática." };
        const selectionAt = item.metadataState?.selection.updatedAt ?? 0;
        let flight = flights.get(key);
        if (flight && (flight.selectionAt !== selectionAt || flight.scope !== scope || flight.controller.signal.aborted)) {
            flight.controller.abort();
            flight = undefined;
        }
        if (!flight) {
            const checkedAt = item.metadataState ? activeMetadataDocument(item.metadataState)?.metadata.provenance.checkedAt : null;
            if (options.automatic && options.automaticIntervalDays !== undefined && !metadataIsStale(checkedAt, options.automaticIntervalDays, now()))
                return { status: "skipped", reason: "Otra consulta ya confirmó metadata reciente." };
            const controller = new AbortController();
            flight = { controller, selectionAt, scope, consumers: new Set(), automatic: !!options.automatic, promise: Promise.resolve({ status: "cancelled" }) };
            const owned = flight;
            flights.set(key, owned);
            owned.promise = Promise.resolve().then(async (): Promise<RefreshResult> => {
                let capture: RefreshCapture | null = null, phase: "begin" | "load" | "commit" = "begin";
                try {
                    capture = await repo.begin({ id, reference, selectionAt, createdAt: item.createdAt }, now(), controller.signal, options.automatic ? options.automaticIntervalDays : undefined);
                    if (!capture)
                        return { status: "skipped", reason: "La obra, su fuente o su frescura cambió antes de consultar." };
                    if (controller.signal.aborted) throw new RefreshError("cancelled");
                    phase = "load";
                    const payload = await abortable(capability.load(item, controller.signal), controller.signal);
                    phase = "commit";
                    if (capability.scope() !== scope)
                        throw new RefreshError("cancelled");
                    const checkedAt = now(), result = await repo.commit(capture, payload, checkedAt, controller.signal);
                    return result.discarded ? { status: "skipped", reason: "Respuesta descartada: cambió la obra, fuente o generación." } : { status: result.changed ? "changed" : "unchanged", checkedAt, diagnostics: payload.diagnostics };
                }
                catch (error) {
                    const failure = controller.signal.aborted ? new RefreshError("cancelled") : error instanceof RefreshError ? error : phase !== "load" ? new RefreshError("persistence") : refreshError(error);
                    if (failure.code === "cancelled")
                        return { status: "cancelled" };
                    const retryAt = failure.code === "rate-limited" && failure.retryAfterMs !== undefined ? Math.min(Number.MAX_SAFE_INTEGER, now() + failure.retryAfterMs) : undefined;
                    if (failure.code === "access-rejected" || failure.code === "rate-limited")
                        blocks.set(reference.provider, { scope, until: retryAt ?? Infinity });
                    if (capture)
                        try {
                            await repo.fail(capture, `${owned.automatic ? "auto" : "manual"}/${failure.code}@${now()}`, retryAt ?? null);
                        }
                        catch { }
                    return { status: "failed", code: failure.code, retryAt };
                }
                finally {
                    if (flights.get(key) === owned)
                        flights.delete(key);
                    emit(id);
                }
            });
            emit(id);
        }
        const owned = flight, consumer = {}, signal = options.signal;
        owned.consumers.add(consumer);
        // An automatic consumer retains its failure cooldown even when a manual consumer joins.
        if (options.automatic)
            owned.automatic = true;
        return new Promise(resolve => {
            let done = false;
            const finish = (result: RefreshResult) => { if (done)
                return; done = true; signal?.removeEventListener("abort", cancel); owned.consumers.delete(consumer); if (!owned.consumers.size && flights.get(key) === owned)
                owned.controller.abort(); resolve(result); };
            const cancel = () => finish({ status: "cancelled" });
            if (signal?.aborted) {
                cancel();
                return;
            }
            signal?.addEventListener("abort", cancel, { once: true });
            owned.promise.then(finish, () => finish({ status: "failed", code: "persistence" }));
        });
    }
    return { refresh, inspect, subscribe(listener: (id: string) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, isRunning: (id: string) => [...flights.keys()].some(key => JSON.parse(key)[0] === id) };
}
export type MetadataRefreshCoordinator = ReturnType<typeof createMetadataRefreshCoordinator>;
