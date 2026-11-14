import { readMediaPreferencesWithDb } from "./mediaPreferencesRepo";
import { hasMetadataSchemaWithDb } from "./mediaMetadataRepo";
import type { PortableMediaPreferences } from "../core/mediaPreferences";
import { parsePortableActivity, type PortableActivityEvent } from "../core/libraryBackupV8";
import type { SavedTitleWithProviderReferences } from "../core/savedTitle";
import type { BackupLegacyIdentityV7, BackupPinV7 } from "../core/libraryBackupV7";
import type { AppearanceBackupAvailability } from "../theme/appearanceBackupAvailability";
import { initDb } from "./db";
import { listSavedTitlesWithReferencesWithDb } from "./savedTitleStorage";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import {
  listAllPinsForBackupV5WithDb,
  type TitlePinsDatabase,
} from "./titlePinsRepo";

export type LibraryBackupExportData = {
  items: Array<SavedTitleWithProviderReferences & { legacyIdentity?: BackupLegacyIdentityV7 }>;
  pins: BackupPinV7[];
  preferences?: PortableMediaPreferences;
  activity?: PortableActivityEvent[];
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
      throw new Error(`El MediaItem ${item.id} tiene varias identidades manuales legacy y no puede representarse en backup v7.`);
    }
    const legacy = legacyIdentities[0];
    return legacy ? { ...item, legacyIdentity: { format: "library-backup-v1-v4" as const, provider: "manual" as const, externalId: legacy.legacy_external_id } } : item;
  }));
  const pins = await listAllPinsForBackupV5WithDb(db);
  if (await hasMetadataSchemaWithDb(db)) {
    const activityRows = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM library_activity_events WHERE occurred_at>=? ORDER BY occurred_at DESC,id DESC LIMIT 2000;", Date.now() - 90 * 86400000);
    const activity = activityRows.map(row => parsePortableActivity({ id: row.id, itemId: row.saved_title_id, occurredAt: row.occurred_at,
      kind: row.kind, origin: row.origin, fields: JSON.parse(String(row.fields_json)), operationKey: row.operation_key }));
    return { items, pins, appearanceAvailability, preferences: await readMediaPreferencesWithDb(db), activity };
  }
  return { items, pins, appearanceAvailability };
}

export async function getLibraryBackupExportData(
  appearanceAvailability: AppearanceBackupAvailability,
  database?: LibraryBackupExportDatabase & { withTransactionAsync(task: () => Promise<void>): Promise<void> }
): Promise<LibraryBackupExportData> {
  return runSerializedStorageMutation(async () => {
    const db = database ?? await initDb();
    let result: LibraryBackupExportData | undefined;
    await db.withTransactionAsync(async () => { result = await getLibraryBackupExportDataWithDb(db, appearanceAvailability); });
    return result!;
  });
}
