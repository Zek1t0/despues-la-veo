import type { SchemaDatabase } from "./databaseSchema";
import { initialMetadataState } from "../core/mediaMetadataState";
import { rowToSavedTitle, listProviderReferencesForSavedTitleWithDb } from "./savedTitleRows";

const timestamp = (name: string) => `${name} INTEGER NOT NULL CHECK(typeof(${name})='integer' AND ${name}>=0 AND ${name}<=9007199254740991)`;
const source = `saved_title_id TEXT NOT NULL, provider TEXT NOT NULL, resource_namespace TEXT NOT NULL, external_id TEXT NOT NULL`;
const sourceForeignKey = `FOREIGN KEY(saved_title_id,provider,resource_namespace,external_id) REFERENCES media_provider_references(saved_title_id,provider,resource_namespace,external_id) ON DELETE CASCADE`;
export const MEDIA_METADATA_SCHEMA_SQL = `
CREATE UNIQUE INDEX idx_media_reference_owner ON media_provider_references(saved_title_id,provider,resource_namespace,external_id);
CREATE TABLE media_metadata (${source}, document_version INTEGER NOT NULL CHECK(document_version=1), document_json TEXT NOT NULL,
 ${timestamp("metadata_changed_at")}, checked_at INTEGER NULL, source_updated_at INTEGER NULL, ${timestamp("revision")},
 PRIMARY KEY(saved_title_id,provider,resource_namespace,external_id), ${sourceForeignKey});
CREATE TABLE media_metadata_selection (saved_title_id TEXT PRIMARY KEY NOT NULL,
 provider TEXT NULL, resource_namespace TEXT NULL, external_id TEXT NULL,
 ${timestamp("selected_at")}, legacy_snapshot_json TEXT NOT NULL, baseline_reference_json TEXT NULL, baseline_updated_at REAL NOT NULL CHECK(baseline_updated_at>=0 AND baseline_updated_at<=1.7976931348623157e308),
 FOREIGN KEY(saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE,
 ${sourceForeignKey}, CHECK ((provider IS NULL AND resource_namespace IS NULL AND external_id IS NULL) OR
 (provider IS NOT NULL AND resource_namespace IS NOT NULL AND external_id IS NOT NULL)));
CREATE TABLE media_title_aliases (${source}, value TEXT NOT NULL, normalized TEXT NOT NULL, language TEXT NULL, script TEXT NULL,
 PRIMARY KEY(saved_title_id,provider,resource_namespace,external_id,value),
 FOREIGN KEY(saved_title_id,provider,resource_namespace,external_id) REFERENCES media_metadata(saved_title_id,provider,resource_namespace,external_id) ON DELETE CASCADE);
CREATE INDEX idx_media_alias_title ON media_title_aliases(saved_title_id,normalized);
CREATE TABLE media_refresh_state (${source}, ${timestamp("generation")}, last_attempt_at INTEGER NULL, backoff_until INTEGER NULL, error_code TEXT NULL,
 PRIMARY KEY(saved_title_id,provider,resource_namespace,external_id), ${sourceForeignKey});
CREATE TABLE library_update_runs (id TEXT PRIMARY KEY NOT NULL, ${timestamp("started_at")}, finished_at INTEGER NULL,
 state TEXT NOT NULL CHECK(state IN ('running','completed','partial','cancelled','interrupted')),
 counters_json TEXT NOT NULL, errors_json TEXT NOT NULL);
CREATE INDEX idx_library_runs_date ON library_update_runs(started_at,id);
CREATE TABLE library_activity_events (id TEXT PRIMARY KEY NOT NULL, saved_title_id TEXT NOT NULL,
 ${timestamp("occurred_at")}, kind TEXT NOT NULL, origin TEXT NOT NULL CHECK(origin IN ('metadata','personal')),
 fields_json TEXT NOT NULL, operation_key TEXT NOT NULL UNIQUE,
 FOREIGN KEY(saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE);
CREATE INDEX idx_library_activity_date ON library_activity_events(occurred_at,id);
CREATE INDEX idx_library_activity_kind_date ON library_activity_events(origin,occurred_at,id);
`;

export async function createMetadataSchemaWithDb(db: SchemaDatabase): Promise<void> {
  await db.execAsync(MEDIA_METADATA_SCHEMA_SQL);
}
export async function backfillMetadataBaselinesWithDb(db: SchemaDatabase): Promise<void> {
  const rows = await db.getAllAsync<Record<string, unknown>>("SELECT * FROM saved_titles ORDER BY id;");
  for (const row of rows) {
    const state = initialMetadataState(rowToSavedTitle(row), await listProviderReferencesForSavedTitleWithDb(db, String(row.id)));
    const ref = state.selection.reference;
    await db.runAsync(`INSERT INTO media_metadata_selection VALUES (?, ?, ?, ?, 0, ?, ?, ?);`,
      row.id, ref?.provider ?? null, ref?.resourceNamespace ?? null, ref?.externalId ?? null,
      JSON.stringify(state.baseline.snapshot), ref ? JSON.stringify(ref) : null, state.baseline.updatedAt);
  }
}
export async function verifyMetadataSchemaWithDb(db: SchemaDatabase): Promise<void> {
  for (const statement of MEDIA_METADATA_SCHEMA_SQL.split(";").map(sql => sql.trim()).filter(Boolean)) {
    const match = /^CREATE (?:UNIQUE )?(TABLE|INDEX) (\w+)/.exec(statement);
    if (!match) throw new Error("Definición de esquema v7 inválida.");
    const actual = await db.getFirstAsync<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name=?;", match[2]);
    const normalize = (sql: string) => sql.replace(/\s+/g, "").toLowerCase();
    if (!actual || normalize(actual.sql) !== normalize(statement)) throw new Error(`Estructura v7 inválida: ${match[2]}.`);
  }
  for (const table of ["media_metadata","media_metadata_selection","media_title_aliases","media_refresh_state","library_update_runs","library_activity_events"]) {
    if (!await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name=?;", table)) throw new Error(`Falta tabla v7: ${table}.`);
  }
  if (await db.getFirstAsync("PRAGMA foreign_key_check;")) throw new Error("Referencias huérfanas en SQLite v7.");
  if (await db.getFirstAsync(`SELECT id FROM saved_titles WHERE id NOT IN (SELECT saved_title_id FROM media_metadata_selection) LIMIT 1;`)) throw new Error("Baseline v7 ausente.");
}
