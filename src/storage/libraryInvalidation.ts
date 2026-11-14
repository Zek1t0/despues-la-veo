type Change = Readonly<{ revision: number; ids: readonly string[] }>;
let revision = 0;
const listeners = new Set<(change: Change) => void>();
export const libraryPresentationRevision = () => revision;
export function subscribeLibraryInvalidation(listener: (change: Change) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
/** Only public transaction owners call this after successful COMMIT. */
export function publishLibraryInvalidation(ids: readonly string[]): void {
  if (!ids.length) return;
  const change = { revision: ++revision, ids: [...new Set(ids)] };
  for (const listener of listeners) { try { listener(change); } catch { /* observers cannot undo commit */ } }
}

/** Coalesces requests, closes the read/subscribe race, and ignores late/unmounted results. */
export function observeLibraryProjection<T>(read: () => Promise<T>, apply: (value: T) => void,
  affected: (ids: readonly string[]) => boolean = () => true, onError: (error: unknown) => void = () => {}): () => void {
  let active = true, reading = false, dirty = false;
  let relevantRevision = revision;
  async function refresh() {
    if (!active) return;
    if (reading) { dirty = true; return; }
    reading = true;
    try {
      do {
        dirty = false;
        const before = relevantRevision;
        const value = await read();
        if (!active) return;
        if (before !== relevantRevision) { dirty = true; continue; }
        apply(value);
      } while (dirty && active);
    } catch (error) { if (active) onError(error); }
    finally { reading = false; }
  }
  // Subscription is synchronous; focus provides the initial consistent snapshot.
  // Only relevant revisions can obsolete a read in flight.
  const unsubscribe = subscribeLibraryInvalidation(change => {
    if (affected(change.ids)) { relevantRevision = change.revision; void refresh(); }
  });
  return () => { active = false; unsubscribe(); };
}
