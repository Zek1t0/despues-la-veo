import * as SQLite from "expo-sqlite";
import { enableAndVerifyForeignKeys, ensureLibrarySchema, type SchemaDatabase } from "../../storage/databaseSchema";
import { saveProviderTitle, attachProviderReferenceWithDb, updateSavedTitleMetadataWithDb, setPersonalRatingWithDb, type SavedTitlesMutationDatabase } from "../../storage/savedTitlesRepo";
import { upsertSavedTitleAndCleanPinsWithDb, deleteSavedTitleAndPinsWithDb } from "../../storage/savedTitleIntegrity";
import { getLibraryScreenSnapshot } from "../../storage/libraryScreenSnapshot";
import { getTitleDetailPinSnapshot } from "../../storage/titleDetailPinSnapshot";
import { setTitlePinStateWithDb } from "../../storage/titlePinsRepo";
import { runSerializedStorageMutation } from "../../storage/storageMutationQueue";
import { getLibraryBackupExportDataWithDb } from "../../storage/libraryBackupExport";
import { mergeLibraryBackupWithDb } from "../../storage/libraryBackupMerge";
import { createLibraryBackupV6 } from "../../core/libraryBackupV6";
import { parseLibraryBackup } from "../../core/libraryBackup";
import { VIEW_PREFERENCE_DEFAULTS, type ViewPreferenceKey, type ViewPreferenceValueByKey } from "../../core/viewPreferences";
import { DEFAULT_APPEARANCE_PREFERENCE } from "../../theme/appearancePreference";
import type { ThemePersistence } from "../../theme/AppThemeProvider";
import { isMediaReviewEnabled } from "./mode";
import { fixtureInput, reviewFixtures, type ReviewFixture } from "./fixtures";

export type ReviewDatabase = SchemaDatabase & SavedTitlesMutationDatabase & { closeAsync(): Promise<void> };
const validName = (name: string) => /^media-review-[a-z0-9-]+\.db$/.test(name);

export async function createReviewSession(options: Readonly<{
  development: boolean; flag?: string;
  open?: (name: string) => Promise<ReviewDatabase>;
  remove?: (name: string) => Promise<void>;
}>) {
  if (!isMediaReviewEnabled(options.development, options.flag)) throw new Error("Revisión no habilitada.");
  const identity = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const primaryName = "media-review-primary.db", restoreName = "media-review-restore.db";
  const open = options.open ?? SQLite.openDatabaseAsync;
  const remove = options.remove ?? SQLite.deleteDatabaseAsync;
  if (!validName(primaryName) || !validName(restoreName)) throw new Error("DBs de revisión inválidas.");
  let primary: ReviewDatabase | null = null, restore: ReviewDatabase | null = null;
  try {
    primary = await open(primaryName);
    restore = await open(restoreName);
    for (const db of [primary, restore]) {
      await enableAndVerifyForeignKeys(db);
      await ensureLibrarySchema(db);
    }
  } catch (error) { await primary?.closeAsync(); await restore?.closeAsync(); throw error; }
  const sourceDb = primary, restoreDb = restore;
  let nextId = 0, closed = false;
  const generateId = () => `review-local-${identity}-${++nextId}`;
  const requireOpen = () => { if (closed) throw new Error("Sesión de revisión cerrada."); };
  const transaction = <T>(operation: (db: ReviewDatabase) => Promise<T>, db = sourceDb): Promise<T> =>
    runSerializedStorageMutation(async () => {
      requireOpen(); let result: T;
      await db.withTransactionAsync(async () => { result = await operation(db); });
      return result!;
    });
  const preferences: ViewPreferenceValueByKey = { ...VIEW_PREFERENCE_DEFAULTS };
  let appearance = DEFAULT_APPEARANCE_PREFERENCE;
  const themePersistence: ThemePersistence = {
    read: async () => ({ status: "valid", preference: appearance, updatedAt: 1 }),
    write: async preference => { appearance = preference; },
  };
  const repository = (db: ReviewDatabase) => ({
    getLibraryScreenSnapshot: () => { requireOpen(); return getLibraryScreenSnapshot(db); },
    getTitleDetailPinSnapshot: (id: string, params: Parameters<typeof getTitleDetailPinSnapshot>[1]) => {
      requireOpen(); return getTitleDetailPinSnapshot(id, params, db);
    },
    deleteSavedTitle: (id: string) => transaction(current => deleteSavedTitleAndPinsWithDb(current, id), db),
    upsertSavedTitle: (item: Parameters<typeof upsertSavedTitleAndCleanPinsWithDb>[1]) => transaction(current => upsertSavedTitleAndCleanPinsWithDb(current, item), db),
    updateSavedTitleMetadata: (id: string, patch: Parameters<typeof updateSavedTitleMetadataWithDb>[2]) => transaction(current => updateSavedTitleMetadataWithDb(current, id, patch), db),
    setPersonalRating: (id: string, value: Parameters<typeof setPersonalRatingWithDb>[2]) => transaction(current => setPersonalRatingWithDb(current, id, value), db),
    setTitlePinState: (id: string, context: Parameters<typeof setTitlePinStateWithDb>[2], pinnedAt: number | null) => transaction(current => setTitlePinStateWithDb(current, id, context, pinnedAt), db),
    getViewPreference: async <K extends ViewPreferenceKey>(key: K): Promise<ViewPreferenceValueByKey[K]> => preferences[key],
    setViewPreference: async <K extends ViewPreferenceKey>(key: K, value: ViewPreferenceValueByKey[K]) => { preferences[key] = value; },
  });
  const source = repository(sourceDb), restored = repository(restoreDb);
  const save = async (fixture: ReviewFixture, patch: Parameters<typeof fixtureInput>[1] = {}, reference = fixture.reference) => {
    requireOpen();
    const id = await saveProviderTitle(fixtureInput(fixture, patch, reference), generateId, sourceDb);
    if (fixture.additionalReferences?.length) await transaction(async db => {
      for (const additional of fixture.additionalReferences!) await attachProviderReferenceWithDb(db, additional, id);
    });
    return id;
  };
  const seed = async () => {
    for (const fixture of reviewFixtures) {
      const id = await save(fixture);
      if (fixture.key === "anime-movie" || fixture.key === "anime-ova") {
        const reference = { provider: "tmdb", resourceNamespace: "movie", externalId: fixture.key === "anime-movie" ? "900009" : "900008" };
        await transaction(db => attachProviderReferenceWithDb(db, reference, id));
        await save(fixture, { voteAverage: 7.9 }, reference);
      }
    }
  };
  const exportTest = () => transaction(async db => {
    const data = await getLibraryBackupExportDataWithDb(db, { status: "unavailable", reason: "pending" });
    return JSON.stringify(createLibraryBackupV6(data.items, data.pins, data.appearanceAvailability), null, 2);
  });
  const importTest = (json: string) => {
    requireOpen(); const parsed = parseLibraryBackup(json);
    if (!parsed.ok || parsed.payload.version !== 6) throw new Error("La revisión restaura únicamente backup TEST v6.");
    return transaction(db => mergeLibraryBackupWithDb(db, parsed.payload, generateId), restoreDb);
  };
  const close = () => runSerializedStorageMutation(async () => {
    if (closed) return; closed = true;
    await sourceDb.closeAsync(); await restoreDb.closeAsync();
  });
  const reset = async () => {
    await close();
    // Captured names only: callers cannot redirect cleanup to another database.
    for (const name of [primaryName, restoreName]) {
      if (!validName(name)) throw new Error("No se permite borrar una DB ajena a revisión.");
      await remove(name);
    }
  };
  return { identity, names: Object.freeze({ primary: primaryName, restore: restoreName }),
    source, restored, themePersistence, save, seed, exportTest, importTest, close, reset };
}

export type ReviewSession = Awaited<ReturnType<typeof createReviewSession>>;
