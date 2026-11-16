import { activityWriteRevision, publishActivityCommit } from "./libraryActivitySignals";
let mutationQueue: Promise<void> = Promise.resolve();

export function runSerializedStorageMutation<T>(task: () => Promise<T>): Promise<T> {
  const committed = async () => {
    const before = activityWriteRevision();
    const result = await task();
    if (before !== activityWriteRevision()) publishActivityCommit();
    return result;
  };
  const result = mutationQueue.then(committed, committed);
  mutationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}
