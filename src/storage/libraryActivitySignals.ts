// Writers mark inside their transaction. Only the serialized owner publishes after success.
let writes = 0;
const listeners = new Set<() => void>();
export const activityWriteRevision = () => writes;
export const markActivityWrite = () => { writes++; };
export function publishActivityCommit() { for (const listener of listeners) { try { listener(); } catch {} } }
export function subscribeLibraryActivity(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
