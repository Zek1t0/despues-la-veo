import {
  credentialNotConfiguredError,
  credentialStorageError,
  TmdbError,
} from "../tmdbErrors";
import { normalizeTmdbCredential, requireNormalizedTmdbCredential } from "./normalizeTmdbCredential";
import type {
  TmdbCredentialSnapshot,
  TmdbCredentialStore,
  TmdbCredentialValidator,
} from "./tmdbCredentialTypes";

type Listener = (snapshot: TmdbCredentialSnapshot) => void;

function storageFailure(error: unknown): TmdbError {
  if (error instanceof TmdbError && error.kind === "credential-storage-error") return error;
  return credentialStorageError();
}

export class TmdbCredentialService {
  private token: string | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private snapshot: TmdbCredentialSnapshot = Object.freeze({
    status: "initializing",
    tokenAvailable: false,
    generation: 0,
  });
  private readonly listeners = new Set<Listener>();
  private mutationTail: Promise<void> = Promise.resolve();
  private deleteGate: Promise<void> | null = null;

  constructor(
    private readonly store: TmdbCredentialStore,
    private readonly validator: TmdbCredentialValidator,
  ) {}

  getSnapshot(): TmdbCredentialSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async resolveToken(): Promise<string> {
    while (this.deleteGate) {
      const gate = this.deleteGate;
      await gate;
      if (this.deleteGate !== null && this.deleteGate !== gate) continue;
    }
    await this.ensureInitialized();
    if (this.snapshot.status === "storage-error") throw credentialStorageError();
    if (this.token === null) throw credentialNotConfiguredError();
    return this.token;
  }

  async initialize(): Promise<TmdbCredentialSnapshot> {
    await this.ensureInitialized();
    return this.snapshot;
  }

  async retryInitialization(): Promise<TmdbCredentialSnapshot> {
    if (this.initializationPromise) {
      await this.initializationPromise;
      return this.snapshot;
    }
    if (this.snapshot.status !== "storage-error") return this.snapshot;
    this.initialized = false;
    await this.ensureInitialized(true);
    return this.snapshot;
  }

  save(candidate: string): Promise<TmdbCredentialSnapshot> {
    return this.enqueueMutation(async () => {
      await this.ensureInitialized();
      const normalized = requireNormalizedTmdbCredential(candidate);
      await this.validator(normalized);
      try {
        await this.store.set(normalized);
      } catch (error) {
        throw storageFailure(error);
      }
      const changed = this.token !== normalized;
      this.token = normalized;
      this.initialized = true;
      this.publish("configured", true, changed ? this.snapshot.generation + 1 : this.snapshot.generation);
      return this.snapshot;
    });
  }

  delete(): Promise<TmdbCredentialSnapshot> {
    let releaseDelete!: () => void;
    const deleteCompleted = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });
    const previousGate = this.deleteGate ?? Promise.resolve();
    const acceptedGate = previousGate.then(() => deleteCompleted);
    this.deleteGate = acceptedGate;

    return this.enqueueMutation(async () => {
      try {
        await this.ensureInitialized();
        await this.store.delete();
        const changed = this.token !== null;
        this.token = null;
        this.initialized = true;
        this.publish(
          "not-configured",
          false,
          changed ? this.snapshot.generation + 1 : this.snapshot.generation,
        );
        return this.snapshot;
      } catch (error) {
        throw storageFailure(error);
      } finally {
        if (this.deleteGate === acceptedGate) this.deleteGate = null;
        releaseDelete();
      }
    });
  }

  private async ensureInitialized(explicitRetry = false): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;
    if (this.snapshot.status === "storage-error" && !explicitRetry) {
      throw credentialStorageError();
    }

    this.publish("initializing", false, this.snapshot.generation);
    const attempt = (async () => {
      try {
        const stored = await this.store.get();
        this.token = stored === null ? null : normalizeTmdbCredential(stored);
        if (this.token === "") this.token = null;
        this.initialized = true;
        this.publish(
          this.token === null ? "not-configured" : "configured",
          this.token !== null,
          this.snapshot.generation,
        );
      } catch (error) {
        this.initialized = false;
        this.publish("storage-error", false, this.snapshot.generation);
        throw storageFailure(error);
      }
    })();
    this.initializationPromise = attempt;
    void attempt.then(
      () => {
        if (this.initializationPromise === attempt) this.initializationPromise = null;
      },
      () => {
        if (this.initializationPromise === attempt) this.initializationPromise = null;
      },
    );
    return attempt;
  }

  private enqueueMutation<T>(mutation: () => Promise<T>): Promise<T> {
    const result = this.mutationTail.then(mutation, mutation);
    this.mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  private publish(
    status: TmdbCredentialSnapshot["status"],
    tokenAvailable: boolean,
    generation: number,
  ): void {
    const next = Object.freeze({ status, tokenAvailable, generation });
    if (
      next.status === this.snapshot.status &&
      next.tokenAvailable === this.snapshot.tokenAvailable &&
      next.generation === this.snapshot.generation
    ) return;
    this.snapshot = next;
    for (const listener of this.listeners) {
      try {
        listener(next);
      } catch {
        // Los subscribers son observers: sus fallos no alteran el estado ni las operaciones del core.
      }
    }
  }
}
