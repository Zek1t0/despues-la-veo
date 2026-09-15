import type { SavedTitleWithProviderReferences } from "../core/savedTitle";
import type { BackupLegacyIdentityV5, BackupPinV5 } from "../core/libraryBackupV5";
import type { AppearanceBackupAvailability } from "../theme/appearanceBackupAvailability";
import { initDb } from "./db";
import { listSavedTitlesWithReferencesWithDb } from "./savedTitleStorage";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import {
  listAllPinsForBackupV5WithDb,
  type TitlePinsDatabase,
} from "./titlePinsRepo";

export type LibraryBackupExportData = {
  items: Array<SavedTitleWithProviderReferences & { legacyIdentity?: BackupLegacyIdentityV5 }>;
  pins: BackupPinV5[];
  appearanceAvailability: AppearanceBackupAvailability;
};

type LibraryBackupExportDatabase = TitlePinsDatabase;

export async function getLibraryBackupExportDataWithDb(
  db: LibraryBackupExportDatabase,
  appearanceAvailability: AppearanceBackupAvailability
): Promise<LibraryBackupExportData> {
  const currentItems = await listSavedTitlesWithReferencesWithDb(db);
  const items = await Promise.all(currentItems.map(async (item) => {
    const legacyIdentities = await db.getAllAsync<{ legacy_external_id: string }>(
      `SELECT legacy_external_id FROM legacy_saved_title_identities
       WHERE saved_title_id = ? AND legacy_format = 'library-backup-v1-v4'
         AND legacy_provider = 'manual';`,
      [item.id]
    );
    if (legacyIdentities.length > 1) {
      throw new Error(`El MediaItem ${item.id} tiene varias identidades manuales legacy y no puede representarse en backup v5.`);
    }
    const legacy = legacyIdentities[0];
    return legacy ? { ...item, legacyIdentity: { format: "library-backup-v1-v4" as const, provider: "manual" as const, externalId: legacy.legacy_external_id } } : item;
  }));
  const pins = await listAllPinsForBackupV5WithDb(db);
  return { items, pins, appearanceAvailability };
}

export async function getLibraryBackupExportData(
  appearanceAvailability: AppearanceBackupAvailability
): Promise<LibraryBackupExportData> {
  return runSerializedStorageMutation(async () =>
    getLibraryBackupExportDataWithDb(await initDb(), appearanceAvailability)
  );
}
