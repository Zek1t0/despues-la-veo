import type { SchemaDatabase } from "./databaseSchema";

const uuid = (column: string) => `CHECK(length(${column})=36 AND substr(${column},9,1)='-' AND
  substr(${column},14,1)='-' AND substr(${column},19,1)='-' AND substr(${column},24,1)='-' AND
  length(replace(${column},'-',''))=32 AND replace(${column},'-','') NOT GLOB '*[^0-9a-f]*')`;
const natural = (column: string, max: number) => `CHECK(typeof(${column})='integer' AND ${column} BETWEEN 0 AND ${max})`;
const references = (kind: "group" | "unit") => `CREATE TABLE granular_${kind}_references (
  owner_id TEXT NOT NULL, entity_id TEXT NOT NULL,
  provider TEXT NOT NULL, parent_namespace TEXT NOT NULL, parent_id TEXT NOT NULL,
  namespace TEXT NOT NULL, external_id TEXT NOT NULL,
  PRIMARY KEY(provider,parent_namespace,parent_id,namespace,external_id),
  FOREIGN KEY(owner_id,entity_id) REFERENCES granular_${kind}s(owner_id,id) ON DELETE CASCADE,
  CHECK(length(provider)>0 AND length(parent_namespace)>0 AND length(parent_id)>0
    AND length(namespace)>0 AND length(external_id)>0)
);
CREATE INDEX granular_${kind}_reference_entity ON granular_${kind}_references(owner_id,entity_id);`;

export const GRANULAR_SCHEMA_SQL = `
CREATE TABLE granular_groups (
  id TEXT PRIMARY KEY NOT NULL ${uuid("id")},
  owner_id TEXT NOT NULL REFERENCES saved_titles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('manual','season','volume')),
  label TEXT NOT NULL CHECK(length(label)>0),
  UNIQUE(owner_id,id)
);
CREATE TABLE granular_units (
  id TEXT PRIMARY KEY NOT NULL ${uuid("id")},
  owner_id TEXT NOT NULL REFERENCES saved_titles(id) ON DELETE CASCADE,
  group_id TEXT,
  coordinate TEXT NOT NULL,
  label TEXT,
  sort_kind INTEGER NOT NULL ${natural("sort_kind",3)},
  sort_group INTEGER NOT NULL ${natural("sort_group",9999)},
  sort_whole INTEGER NOT NULL ${natural("sort_whole",999999)},
  sort_fraction TEXT NOT NULL CHECK(length(sort_fraction)=6 AND sort_fraction NOT GLOB '*[^0-9]*'),
  retired INTEGER NOT NULL CHECK(retired IN (0,1)),
  UNIQUE(owner_id,id),
  FOREIGN KEY(owner_id,group_id) REFERENCES granular_groups(owner_id,id)
);
CREATE INDEX granular_units_order ON granular_units(owner_id,sort_kind,sort_group,sort_whole,sort_fraction,id);
CREATE INDEX granular_units_group_order ON granular_units(owner_id,group_id,sort_kind,sort_group,sort_whole,sort_fraction,id);
${references("group")}
${references("unit")}
CREATE TABLE granular_decisions (
  owner_id TEXT NOT NULL, unit_id TEXT NOT NULL,
  marked INTEGER NOT NULL CHECK(marked IN (0,1)),
  consumed_on TEXT CHECK(consumed_on IS NULL OR (marked=1 AND consumed_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')),
  updated_at INTEGER NOT NULL ${natural("updated_at",Number.MAX_SAFE_INTEGER)},
  revision INTEGER NOT NULL ${natural("revision",Number.MAX_SAFE_INTEGER)} CHECK(revision>0),
  PRIMARY KEY(owner_id,unit_id),
  FOREIGN KEY(owner_id,unit_id) REFERENCES granular_units(owner_id,id) ON DELETE CASCADE
);
CREATE INDEX granular_decision_state ON granular_decisions(owner_id,marked,unit_id);
CREATE TABLE granular_title_state (
  owner_id TEXT PRIMARY KEY NOT NULL REFERENCES saved_titles(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL ${natural("revision",Number.MAX_SAFE_INTEGER)},
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1))
);
CREATE TABLE granular_guide_indices (
  owner_id TEXT NOT NULL REFERENCES saved_titles(id) ON DELETE CASCADE,
  series_id TEXT NOT NULL, language TEXT NOT NULL, checked_at INTEGER NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY(owner_id,series_id,language)
);
CREATE TABLE granular_guide_snapshots (
  owner_id TEXT NOT NULL REFERENCES saved_titles(id) ON DELETE CASCADE,
  series_id TEXT NOT NULL, language TEXT NOT NULL, season INTEGER NOT NULL,
  revision INTEGER NOT NULL, checked_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('accredited','partial','stale')),
  payload TEXT NOT NULL, issues TEXT NOT NULL,
  PRIMARY KEY(owner_id,series_id,language,season)
);
`;

export async function verifyGranularSchema(db: SchemaDatabase): Promise<void> {
  const expected = GRANULAR_SCHEMA_SQL.trim().split(/;\s*/).filter(Boolean);
  const rows = await db.getAllAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE name GLOB 'granular_*' AND sql IS NOT NULL;");
  const normalize = (sql: string) => sql.replace(/\s+/g, " ").trim();
  const actual = new Set(rows.map(row => normalize(row.sql)));
  if (actual.size !== expected.length || expected.some(sql => !actual.has(normalize(sql)))) {
    throw new Error("El esquema de seguimiento granular no coincide con SQLite v10.");
  }
  for (const table of ["groups", "units", "group_references", "unit_references", "decisions", "title_state", "guide_indices", "guide_snapshots"]) {
    if ((await db.getAllAsync(`PRAGMA foreign_key_check(granular_${table});`)).length) {
      throw new Error("El seguimiento granular contiene referencias inválidas.");
    }
  }
}
