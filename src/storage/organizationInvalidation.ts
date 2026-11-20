const listeners = new Set<() => void>();
export function subscribeOrganization(listener: () => void): () => void {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
/** Called only by transaction owners after COMMIT. */
export function publishOrganization(): void {
  for (const listener of listeners) { try { listener(); } catch { /* Commit already succeeded. */ } }
}
