import type { SavedTitle } from "../core/savedTitle";
import { parsePersonalRating } from "../core/personalRating";
import {
  deletePinsForSavedTitleWithDb,
  deleteTagPinsExceptWithDb,
  type TitlePinsDatabase,
} from "./titlePinsRepo";

export type SavedTitleIntegrityDatabase = TitlePinsDatabase;

export async function upsertSavedTitleAndCleanPinsWithDb(
  db: SavedTitleIntegrityDatabase,
  item: SavedTitle
): Promise<string> {
  const personalRating = parsePersonalRating(item.personalRating);
  await db.runAsync(
    `INSERT INTO saved_titles (
      id, provider, external_id, type, title, year, poster_url,
      overview, vote_average, personal_rating, genres_json,
      status, tags_json, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider, external_id) DO UPDATE SET
      type=excluded.type,
      title=excluded.title,
      year=excluded.year,
      poster_url=excluded.poster_url,
      overview=excluded.overview,
      vote_average=excluded.vote_average,
      personal_rating=excluded.personal_rating,
      genres_json=excluded.genres_json,
      status=excluded.status,
      tags_json=excluded.tags_json,
      notes=excluded.notes,
      updated_at=excluded.updated_at`,
    item.id,
    item.provider,
    item.externalId,
    item.type,
    item.title,
    item.year ?? null,
    item.posterUrl ?? null,
    item.overview ?? null,
    item.voteAverage ?? null,
    personalRating,
    JSON.stringify(item.genres ?? []),
    item.status,
    JSON.stringify(item.tags ?? []),
    item.notes ?? null,
    item.createdAt,
    item.updatedAt
  );

  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM saved_titles WHERE provider = ? AND external_id = ? LIMIT 1;",
    [item.provider, item.externalId]
  );
  if (!row?.id) throw new Error("No se pudo leer el id guardado.");

  await deleteTagPinsExceptWithDb(db, row.id, item.tags ?? []);
  return row.id;
}

export async function deleteSavedTitleAndPinsWithDb(
  db: SavedTitleIntegrityDatabase,
  savedTitleId: string
): Promise<void> {
  await deletePinsForSavedTitleWithDb(db, savedTitleId);
  await db.runAsync("DELETE FROM saved_titles WHERE id = ?;", savedTitleId);
}
