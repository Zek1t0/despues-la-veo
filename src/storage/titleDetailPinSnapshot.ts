import type { PinContext } from "../core/contextualPin";
import { LIBRARY_PIN_CONTEXT } from "../core/contextualPin";
import type { SavedTitle } from "../core/savedTitle";
import {
  resolveTitleDetailPinContext,
  type TitleDetailPinParams,
} from "../core/titleDetailPinContext";
import { initDb } from "./db";
import { getSavedTitleByIdWithDb } from "./savedTitlesRepo";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import { getTitlePinPinnedAtWithDb } from "./titlePinsRepo";

export type TitleDetailPinSnapshot = {
  item: SavedTitle | null;
  context: PinContext;
  pinnedAt: number | null;
  pinReadError: unknown | null;
};

export function getTitleDetailPinSnapshot(
  savedTitleId: string,
  params: TitleDetailPinParams
): Promise<TitleDetailPinSnapshot> {
  return runSerializedStorageMutation(async () => {
    const db = await initDb();
    const item = await getSavedTitleByIdWithDb(db, savedTitleId);
    if (!item) {
      return {
        item: null,
        context: LIBRARY_PIN_CONTEXT,
        pinnedAt: null,
        pinReadError: null,
      };
    }

    const context = resolveTitleDetailPinContext(params, item);
    try {
      const pinnedAt = await getTitlePinPinnedAtWithDb(db, item.id, context);
      return { item, context, pinnedAt, pinReadError: null };
    } catch (pinReadError) {
      return { item, context, pinnedAt: null, pinReadError };
    }
  });
}
