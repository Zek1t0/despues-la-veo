import type { ProgressReadDb } from "./personalProgressRepo";
import type { SeasonIndexEntry } from "../providers/tmdb/tmdbGuide";

/** Restored descriptors are navigable offline, with no counter or editorial evidence. */
export async function durableSeasons(db:ProgressReadDb,owner:string,series:string):Promise<SeasonIndexEntry[]> {
  const rows=await db.getAllAsync<{id:string;number:number;title:string}>(`SELECT DISTINCT g.external_id AS id,u.sort_group AS number,local.label AS title
    FROM granular_units u
    JOIN granular_groups local ON local.owner_id=u.owner_id AND local.id=u.group_id
    JOIN granular_group_references g ON g.owner_id=u.owner_id AND g.entity_id=local.id
    JOIN granular_unit_references e ON e.owner_id=u.owner_id AND e.entity_id=u.id
    JOIN media_provider_references p ON p.saved_title_id=u.owner_id AND p.provider='tmdb' AND p.resource_namespace='tv' AND p.external_id=g.parent_id
    WHERE u.owner_id=? AND u.sort_kind=1 AND g.provider='tmdb' AND g.parent_namespace='tv' AND g.namespace='season' AND g.parent_id=?
      AND e.provider='tmdb' AND e.parent_namespace='tv' AND e.namespace='episode' AND e.parent_id=g.parent_id
    ORDER BY number,id`,owner,series);
  return rows.map(row=>({...row,count:null}));
}

export function navigableSeasons(editorial: readonly SeasonIndexEntry[], durable: readonly SeasonIndexEntry[]) {
  const index=[...editorial];
  const conflicts=new Set<number>();
  const numbers=new Map(editorial.map(entry=>[entry.id,entry.number]));
  for(const entry of durable) {
    const sameNumber=durable.filter(other=>other.number===entry.number);
    const cached=editorial.find(other=>other.number===entry.number);
    const knownNumber=numbers.get(entry.id);
    if(sameNumber.some(other=>other.id!==entry.id) || (cached && cached.id!==entry.id) ||
      (knownNumber!==undefined && knownNumber!==entry.number) ||
      durable.some(other=>other.id===entry.id && other.number!==entry.number)) {
      conflicts.add(entry.number);
      if(knownNumber!==undefined)conflicts.add(knownNumber);
    }
  }
  index.push(...durable.filter(entry=>!conflicts.has(entry.number) && !editorial.some(other=>other.number===entry.number)));
  return {index:index.sort((a,b)=>a.number-b.number),conflicts};
}
