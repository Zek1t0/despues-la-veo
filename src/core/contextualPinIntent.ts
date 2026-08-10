export type ContextualPinIntentCallbacks = {
  onOptimistic: (pinnedAt: number | null) => void;
  onRollback: (pinnedAt: number | null) => void;
  onError: (error: unknown) => void;
};

export class ContextualPinIntentQueue {
  private confirmed: number | null;
  private latest: number | null;
  private sequence = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(initialPinnedAt: number | null) {
    this.confirmed = initialPinnedAt;
    this.latest = initialPinnedAt;
  }

  getLatest(): number | null {
    return this.latest;
  }

  request(
    nextPinnedAt: number | null,
    persist: (pinnedAt: number | null) => Promise<void>,
    callbacks: ContextualPinIntentCallbacks
  ): Promise<void> {
    const requestId = ++this.sequence;
    this.latest = nextPinnedAt;
    callbacks.onOptimistic(nextPinnedAt);

    this.queue = this.queue.then(async () => {
      try {
        await persist(nextPinnedAt);
        this.confirmed = nextPinnedAt;
      } catch (error) {
        if (requestId !== this.sequence) return;
        this.latest = this.confirmed;
        callbacks.onRollback(this.confirmed);
        callbacks.onError(error);
      }
    });
    return this.queue;
  }

  whenIdle(): Promise<void> {
    return this.queue;
  }
}
