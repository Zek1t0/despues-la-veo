import type { SchemaDatabase } from "./databaseSchema";

const timestamp = (name: string) => `${name} INTEGER NOT NULL CHECK(typeof(${name})='integer' AND ${name} BETWEEN 0 AND 9007199254740991)`;
const token = (name: string) => `${name} TEXT NOT NULL CHECK(length(trim(${name}))>0 AND ${name}=trim(${name}))`;
export const ORGANIZATION_SCHEMA: Readonly<Record<string, string>> = {
  personal_collections: `CREATE TABLE personal_collections (
    ${token("id")} PRIMARY KEY, ${token("name")}, description TEXT,
    ${timestamp("created_at")}, ${timestamp("updated_at")});`,
  collection_memberships: `CREATE TABLE collection_memberships (
    ${token("collection_id")}, ${token("saved_title_id")}, ${timestamp("added_at")}, ${timestamp("updated_at")},
    PRIMARY KEY(collection_id,saved_title_id),
    FOREIGN KEY(collection_id) REFERENCES personal_collections(id) ON DELETE CASCADE,
    FOREIGN KEY(saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE);`,
  recommendation_inbox: `CREATE TABLE recommendation_inbox (
    ${token("id")} PRIMARY KEY, original_capture_json TEXT NOT NULL CHECK(json_valid(original_capture_json)),
    capture_kind TEXT NOT NULL CHECK(capture_kind IN ('name','url','reference')),
    name TEXT, url TEXT, provider TEXT, resource_namespace TEXT, external_id TEXT,
    person TEXT, origin TEXT, comment TEXT,
    status TEXT NOT NULL CHECK(status IN ('pending','incorporated','discarded')),
    linked_saved_title_id TEXT REFERENCES saved_titles(id) ON DELETE RESTRICT,
    ${timestamp("created_at")}, ${timestamp("updated_at")},
    CHECK((provider IS NULL AND resource_namespace IS NULL AND external_id IS NULL) OR
      (provider IS NOT NULL AND resource_namespace IS NOT NULL AND external_id IS NOT NULL AND
      length(trim(provider))>0 AND provider=trim(provider) AND length(trim(resource_namespace))>0 AND
      resource_namespace=trim(resource_namespace) AND length(trim(external_id))>0)),
    CHECK((status='incorporated' AND linked_saved_title_id IS NOT NULL) OR
      (status IN ('pending','discarded') AND linked_saved_title_id IS NULL)));`,
  idx_collection_member_title: "CREATE INDEX idx_collection_member_title ON collection_memberships(saved_title_id);",
  idx_collection_member_added: "CREATE INDEX idx_collection_member_added ON collection_memberships(collection_id,added_at);",
  idx_recommendation_reference: "CREATE INDEX idx_recommendation_reference ON recommendation_inbox(provider,resource_namespace,external_id);",
  idx_recommendation_status: "CREATE INDEX idx_recommendation_status ON recommendation_inbox(status,created_at);",
  idx_recommendation_link: "CREATE INDEX idx_recommendation_link ON recommendation_inbox(linked_saved_title_id);",
  reopen_deleted_title_recommendations: `CREATE TRIGGER reopen_deleted_title_recommendations BEFORE DELETE ON saved_titles BEGIN
    UPDATE recommendation_inbox SET status='pending', linked_saved_title_id=NULL,
      updated_at=max(updated_at+1,CAST(strftime('%s','now') AS INTEGER)*1000)
      WHERE linked_saved_title_id=OLD.id;
  END;`,
  preserve_recommendation_original: `CREATE TRIGGER preserve_recommendation_original BEFORE UPDATE OF original_capture_json ON recommendation_inbox
    WHEN NEW.original_capture_json<>OLD.original_capture_json BEGIN SELECT RAISE(ABORT,'La captura original es inmutable.'); END;`,
};
export async function createOrganizationSchemaWithDb(db: SchemaDatabase): Promise<void> {
  for (const sql of Object.values(ORGANIZATION_SCHEMA)) await db.execAsync(sql);
}
export async function verifyOrganizationSchemaWithDb(db: Pick<SchemaDatabase, "getFirstAsync">): Promise<void> {
  const normalize = (sql: string) => sql.toLowerCase().replace(/\s+/g, " ").replace(/;$/, "").trim();
  for (const [name, sql] of Object.entries(ORGANIZATION_SCHEMA)) {
    const row = await db.getFirstAsync<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name=?;", name);
    if (!row || normalize(row.sql) !== normalize(sql)) throw new Error(`Estructura de organización inválida: ${name}.`);
  }
  const fk = await db.getFirstAsync<{ foreign_keys: number }>("PRAGMA foreign_keys;");
  if (fk?.foreign_keys !== 1 || await db.getFirstAsync("PRAGMA foreign_key_check;")) throw new Error("Integridad referencial de organización inválida.");
}
