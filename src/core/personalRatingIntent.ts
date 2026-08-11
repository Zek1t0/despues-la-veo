import { parsePersonalRating, type PersonalRating } from "./personalRating";

export type ConfirmedPersonalRating = {
  value: PersonalRating;
  updatedAt: number;
};

export type PersonalRatingIntentState = {
  confirmed: ConfirmedPersonalRating;
  latest: PersonalRating;
};

export type PersonalRatingIntentCallbacks = {
  onOptimistic: (value: PersonalRating) => void;
  onConfirmed: (state: PersonalRatingIntentState) => void;
  onRollback: (confirmed: ConfirmedPersonalRating) => void;
  onError: (error: unknown) => void;
};

export function applyPersonalRatingConfirmation<
  T extends { personalRating: PersonalRating; updatedAt: number },
>(current: T, state: PersonalRatingIntentState): T {
  return {
    ...current,
    personalRating: state.latest,
    updatedAt: Math.max(current.updatedAt, state.confirmed.updatedAt),
  };
}

export function applyPersonalRatingRollback<
  T extends { personalRating: PersonalRating; updatedAt: number },
>(current: T, confirmed: ConfirmedPersonalRating): T {
  return { ...current, personalRating: confirmed.value };
}

/** Cola local por título. La UI usa latest; storage/reloads usan confirmed. */
export class PersonalRatingIntentQueue {
  private confirmed: ConfirmedPersonalRating;
  private latest: PersonalRating;
  private sequence = 0;
  private pending = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(initial: ConfirmedPersonalRating) {
    this.confirmed = initial;
    this.latest = initial.value;
  }

  getLatest(): PersonalRating {
    return this.latest;
  }

  getConfirmed(): ConfirmedPersonalRating {
    return this.confirmed;
  }

  isPending(): boolean {
    return this.pending > 0;
  }

  /** Reconciliación permitida sólo después de whenIdle(). */
  reconcileConfirmed(snapshot: ConfirmedPersonalRating): void {
    if (this.isPending()) {
      throw new Error("No se puede reconciliar una puntuación mientras hay escrituras pendientes.");
    }
    this.confirmed = snapshot;
    this.latest = snapshot.value;
  }

  request(
    next: PersonalRating,
    persist: (value: PersonalRating) => Promise<number>,
    callbacks: PersonalRatingIntentCallbacks
  ): Promise<void> {
    const canonicalNext = parsePersonalRating(next);
    if (canonicalNext === this.latest) return this.queue;

    const requestId = ++this.sequence;
    this.latest = canonicalNext;
    this.pending += 1;
    callbacks.onOptimistic(canonicalNext);

    this.queue = this.queue.then(async () => {
      try {
        const updatedAt = await persist(canonicalNext);
        this.confirmed = { value: canonicalNext, updatedAt };
        callbacks.onConfirmed({ confirmed: this.confirmed, latest: this.latest });
      } catch (error) {
        if (requestId === this.sequence) {
          this.latest = this.confirmed.value;
          callbacks.onRollback(this.confirmed);
          callbacks.onError(error);
        }
      } finally {
        this.pending -= 1;
      }
    });
    return this.queue;
  }

  whenIdle(): Promise<void> {
    return this.queue;
  }
}
