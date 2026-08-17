import {
  DEFAULT_APPEARANCE_PREFERENCE,
  type AppearanceReadResult,
} from "./appearancePreference";
import type { AppearancePreference } from "./types";

export type AppearanceHydrationStatus = "pending" | "ready" | "invalid" | "error";
export type AppearanceStorageError = Readonly<{
  operation: "read" | "write";
  error: unknown;
}>;
export type AppearanceIntent = Readonly<{ id: number; preference: AppearancePreference }>;
export type AppearanceCoordinatorState = Readonly<{
  latestIntent: AppearanceIntent | null;
  displayed: AppearancePreference;
  confirmedPersisted: AppearancePreference | null;
  hydrationStatus: AppearanceHydrationStatus;
  isHydrationGateOpen: boolean;
  storageError: AppearanceStorageError | null;
  revision: number;
}>;

type Listener = (state: AppearanceCoordinatorState) => void;
type StatePatch = { -readonly [Key in keyof AppearanceCoordinatorState]?: AppearanceCoordinatorState[Key] };
type PendingIntent = AppearanceIntent & {
  resolve: () => void;
  reject: (error: unknown) => void;
};
export type HydrationToken = Readonly<{
  generation: number;
  revision: number;
  storageEpoch: number;
}>;

export class AppearanceCoordinator {
  private state: AppearanceCoordinatorState = {
    latestIntent: null,
    displayed: DEFAULT_APPEARANCE_PREFERENCE,
    confirmedPersisted: null,
    hydrationStatus: "pending",
    isHydrationGateOpen: false,
    storageError: null,
    revision: 0,
  };
  private listeners = new Set<Listener>();
  private generation = 0;
  private storageEpoch = 0;
  private pending: PendingIntent | null = null;
  private pumping = false;
  private disposed = false;

  constructor(private readonly write: (preference: AppearancePreference) => Promise<void>) {}

  getState(): AppearanceCoordinatorState { return this.state; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(patch: StatePatch): void {
    if (this.disposed) return;
    this.state = Object.freeze({ ...this.state, ...patch });
    for (const listener of this.listeners) listener(this.state);
  }

  beginHydration(): HydrationToken {
    const token = Object.freeze({
      generation: ++this.generation,
      revision: this.state.revision,
      storageEpoch: this.storageEpoch,
    });
    if (!this.state.isHydrationGateOpen) this.publish({ hydrationStatus: "pending" });
    return token;
  }

  invalidateHydration(): void {
    this.generation += 1;
  }

  completeHydration(token: HydrationToken, result: AppearanceReadResult): boolean {
    if (this.disposed || token.generation !== this.generation ||
        token.revision !== this.state.revision ||
        token.storageEpoch !== this.storageEpoch) return false;
    if (result.status === "valid") {
      this.publish({ displayed: result.preference, confirmedPersisted: result.preference,
        hydrationStatus: "ready", isHydrationGateOpen: true, storageError: null });
    } else if (result.status === "absent") {
      this.publish({ displayed: DEFAULT_APPEARANCE_PREFERENCE,
        confirmedPersisted: null, hydrationStatus: "ready",
        isHydrationGateOpen: true, storageError: null });
    } else if (result.status === "invalid") {
      this.publish({ displayed: DEFAULT_APPEARANCE_PREFERENCE, confirmedPersisted: null,
        hydrationStatus: "invalid", isHydrationGateOpen: true,
        storageError: { operation: "read", error: new Error("Appearance persistida inválida.") } });
    } else {
      this.publish({ displayed: DEFAULT_APPEARANCE_PREFERENCE, confirmedPersisted: null,
        hydrationStatus: "error", isHydrationGateOpen: true,
        storageError: { operation: "read", error: result.error } });
    }
    return true;
  }

  select(preference: AppearancePreference): Promise<void> {
    const id = this.state.revision + 1;
    const intent = Object.freeze({ id, preference });
    this.publish({
      latestIntent: intent,
      displayed: preference,
      revision: id,
      storageError: this.state.storageError?.operation === "read"
        ? this.state.storageError
        : null,
    });
    if (this.pending) {
      this.pending.resolve();
      this.pending = null;
    }
    const promise = new Promise<void>((resolve, reject) => {
      this.pending = { ...intent, resolve, reject };
    });
    if (!this.pumping) {
      this.pumping = true;
      void Promise.resolve().then(() => this.pump());
    }
    return promise;
  }

  async retryWrite(): Promise<boolean> {
    if (this.state.storageError?.operation !== "write" || !this.state.latestIntent) {
      return false;
    }
    const failedPreference = this.state.latestIntent.preference;
    await this.select(failedPreference);
    return true;
  }

  private async pump(): Promise<void> {
    while (!this.disposed && this.pending) {
      const intent = this.pending;
      this.pending = null;
      try {
        await this.write(intent.preference);
        this.storageEpoch += 1;
        const patch: StatePatch = {
          confirmedPersisted: intent.preference,
        };
        const repairedInvalidHydration = this.state.hydrationStatus === "invalid";
        if (repairedInvalidHydration) {
          patch.hydrationStatus = "ready";
          if (this.state.storageError?.operation === "read") patch.storageError = null;
        }
        if (this.state.latestIntent?.id === intent.id) {
          patch.displayed = intent.preference;
          if (this.state.storageError?.operation !== "read" || repairedInvalidHydration) {
            patch.storageError = null;
          }
        }
        this.publish(patch);
        intent.resolve();
      } catch (error) {
        this.storageEpoch += 1;
        if (this.state.latestIntent?.id === intent.id) {
          this.publish({
            displayed: this.state.confirmedPersisted ?? DEFAULT_APPEARANCE_PREFERENCE,
            storageError: { operation: "write", error },
          });
        }
        intent.reject(error);
      }
    }
    this.pumping = false;
    if (!this.disposed && this.pending) {
      this.pumping = true;
      void this.pump();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.generation += 1;
    this.listeners.clear();
    this.pending?.resolve();
    this.pending = null;
  }
}
