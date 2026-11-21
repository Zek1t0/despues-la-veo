import type { PinContext } from "../core/contextualPin";
import { LIBRARY_PIN_CONTEXT } from "../core/contextualPin";
import type { SavedTitleWithProviderReferences } from "../core/savedTitle";
import {
  resolveTitleDetailPinContext,
  type TitleDetailPinParams,
} from "../core/titleDetailPinContext";
import { initDb } from "./db";
import { getSavedTitleByIdWithDb } from "./savedTitlesRepo";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import { getTitlePinPinnedAtWithDb } from "./titlePinsRepo";
import { getPersonalProgressWithDb, type ProgressDatabase } from "./personalProgressRepo";
import type { PersonalProgress } from "../core/personalProgress";

export type TitleDetailPinSnapshot = {
  item: SavedTitleWithProviderReferences | null;
  context: PinContext;
  pinnedAt: number | null;
  pinReadError: unknown | null;
  progress: PersonalProgress | null;
  progressReadError: unknown | null;
};

export function getTitleDetailPinSnapshot(
  savedTitleId: string,
  params: TitleDetailPinParams,
  database?: Parameters<typeof getSavedTitleByIdWithDb>[0] & Parameters<typeof getTitlePinPinnedAtWithDb>[0] & ProgressDatabase
): Promise<TitleDetailPinSnapshot> {
  return runSerializedStorageMutation(async () => {
    const db = database ?? await initDb();
    let snapshot!: TitleDetailPinSnapshot;
    await db.withTransactionAsync(async () => {
      const item = await getSavedTitleByIdWithDb(db, savedTitleId);
      if (!item) {
        snapshot = {
          item: null, context: LIBRARY_PIN_CONTEXT, pinnedAt: null, pinReadError: null,
          progress: null, progressReadError: null,
        };
        return;
      }

      const context = resolveTitleDetailPinContext(params, item);
      let progress: PersonalProgress | null = null, progressReadError: unknown | null = null;
      try { progress = await getPersonalProgressWithDb(db, item.id); }
      catch (error) { progressReadError = error; }
      try {
        const pinnedAt = await getTitlePinPinnedAtWithDb(db, item.id, context);
        snapshot = { item, context, pinnedAt, pinReadError: null, progress, progressReadError };
      } catch (pinReadError) {
        snapshot = { item, context, pinnedAt: null, pinReadError, progress, progressReadError };
      }
    });
    return snapshot;
  });
}
