import { durableSeasons, navigableSeasons } from "./granularDurableGuide";
import { initDb } from "./db";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import type { ProgressDatabase, ProgressWriteDb } from "./personalProgressRepo";
import { localCivilDay, scopeCoverage, unitAvailability } from "../core/granularCoverage";
import { guideEvidenceCurrent } from "./granularInventory";
import type { GuideScope } from "./granularInventory";
import type { GuideEpisode, SeasonIndexEntry } from "../providers/tmdb/tmdbGuide";
import { state } from "./granularRepo";

type EditorialMember = GuideEpisode & {unitId:string};
type EditorialSnapshot = {guide:{id:string;number:number};members:EditorialMember[]};
export type ScopeView = Awaited<ReturnType<typeof readScopeWithDb>>;
export async function readScopeWithDb(db: ProgressWriteDb, scope: GuideScope, now: number) {
  const row = await db.getFirstAsync<{payload:string;status:"partial"|"stale"|"accredited";checked_at:number;revision:number}>(`SELECT payload,status,checked_at,revision FROM granular_guide_snapshots
    WHERE owner_id=? AND series_id=? AND language=? AND season=?`,scope.ownerId,scope.seriesId,scope.language,scope.season);
  const payload: EditorialSnapshot | null = row ? JSON.parse(row.payload) : null;
  const index = await db.getFirstAsync<{checked_at:number;payload:string}>(`SELECT i.checked_at,i.payload FROM granular_guide_indices i
    JOIN media_provider_references r ON r.saved_title_id=i.owner_id AND r.provider='tmdb' AND r.resource_namespace='tv' AND r.external_id=i.series_id
    WHERE i.owner_id=? AND i.series_id=? AND i.language=?`,scope.ownerId,scope.seriesId,scope.language);
  const editorial = index ? JSON.parse(index.payload) as SeasonIndexEntry[] : [];
  const entry = editorial.find(e=>e.number===scope.season);
  const navigation = navigableSeasons(editorial,await durableSeasons(db,scope.ownerId,scope.seriesId));
  const selected = navigation.index.find(season=>season.number===scope.season);
  const group = selected ? await db.getFirstAsync<{entity_id:string}>(`SELECT entity_id FROM granular_group_references
    WHERE owner_id=? AND provider='tmdb' AND parent_namespace='tv' AND parent_id=? AND namespace='season' AND external_id=?`,scope.ownerId,scope.seriesId,selected.id) : null;
  const rows = group ? await db.getAllAsync<{id:string;number:number;retired:number;marked:number|null;label:string|null;external_id:string}>(`SELECT u.id,u.sort_whole AS number,u.retired,d.marked,u.label,r.external_id
    FROM granular_units u JOIN granular_unit_references r ON r.owner_id=u.owner_id AND r.entity_id=u.id
    LEFT JOIN granular_decisions d ON d.owner_id=u.owner_id AND d.unit_id=u.id
    WHERE u.owner_id=? AND u.group_id=? AND u.sort_kind=1 AND u.sort_group=?
      AND r.provider='tmdb' AND r.parent_namespace='tv' AND r.parent_id=? AND r.namespace='episode'
    ORDER BY u.sort_whole,u.id,r.external_id`,scope.ownerId,group.entity_id,scope.season,scope.seriesId) : [];
  const byId = new Map(rows.map(unit=>[unit.id,unit]));
  const references = new Set(rows.map(unit=>`${unit.id}:${unit.external_id}`));
  // Only exact snapshot identities can supply metadata or count as evidence.
  const cache = payload?.guide.id===selected?.id ? payload?.members??[] : [];
  const evidence = new Map<string,EditorialMember>();
  for(const member of cache) {
    if(byId.get(member.unitId)?.number===member.number && references.has(`${member.unitId}:${member.id}`)) evidence.set(member.unitId,member);
  }
  const members = [...byId.values()].map(unit=>evidence.get(unit.id)??{
    id:unit.external_id,unitId:unit.id,number:unit.number,title:unit.label,airDate:null,overview:null,runtime:null,image:null,
  });
  const today=localCivilDay(new Date(now));
  const structuralMode = !row ? "partial" : !index
    || (row.status==="accredited" && (entry?.id!==payload?.guide.id || entry?.count!==evidence.size ||
      payload?.members.length!==evidence.size || navigation.conflicts.has(scope.season) ||
      [...evidence.keys()].some(id=>byId.get(id)?.retired) || [...byId.values()].filter(unit=>!unit.retired).length!==evidence.size))
    ? "stale" : row.status;
  const mode = row && (!index || !guideEvidenceCurrent(index.checked_at,now) || !guideEvidenceCurrent(row.checked_at,now)) ? "stale" : structuralMode;
  const projected=members.map(member=>({...member,retired:!!byId.get(member.unitId)?.retired,marked:byId.get(member.unitId)?.marked===1}));
  const accreditedMembers=projected.filter(member=>evidence.has(member.unitId));
  const coverage=scopeCoverage((mode==="accredited"?accreditedMembers:projected).map(member=>({marked:member.marked,
    availability:unitAvailability(member.airDate,member.retired,today),special:scope.season===0 || member.number===0})),mode);
  return {members:projected,accreditedMembers,structuralMode,indexCheckedAt:index?.checked_at??null,marked:projected.filter(member=>member.marked).length,group:group?.entity_id ?? null,mode,coverage,checkedAt:row?.checked_at??null,
    revision:row?.revision??null,eligible:members.filter(member=>scope.season!==0 && member.number!==0 &&
      unitAvailability(member.airDate,!!byId.get(member.unitId)?.retired,today)==="Estrenado").map(member=>member.unitId)};
}

export function readGranularScreen(owner: string, scope: GuideScope | null, db?: ProgressDatabase, now=Date.now(), manualGroup?:string|null) {
  return runSerializedStorageMutation(async()=>{
    const connection=db??await initDb();
    let result!: {
      revision:number; enabled:number; groups:{id:string;label:string}[]; guide:ScopeView|null;
      manual:{total:number;marked:number}; marked:number;
    };
    await connection.withTransactionAsync(async()=>{
      const groups=await connection.getAllAsync<{id:string;label:string}>(`SELECT id,label FROM granular_groups g
        WHERE owner_id=? AND NOT EXISTS(SELECT 1 FROM granular_group_references WHERE entity_id=g.id) ORDER BY label,id`,owner);
      const manual=await connection.getFirstAsync<{total:number;marked:number}>(`SELECT COUNT(*) AS total, COUNT(CASE WHEN d.marked=1 THEN 1 END) AS marked
        FROM granular_units u LEFT JOIN granular_decisions d ON d.owner_id=u.owner_id AND d.unit_id=u.id
        WHERE u.owner_id=? AND u.retired=0 AND NOT EXISTS(SELECT 1 FROM granular_unit_references WHERE entity_id=u.id)
        ${manualGroup===undefined?"":"AND u.group_id IS ?"}`,owner,...(manualGroup===undefined?[]:[manualGroup]));
      const marked=await connection.getFirstAsync<{total:number}>("SELECT COUNT(*) AS total FROM granular_decisions WHERE owner_id=? AND marked=1",owner);
      result={...await state(connection,owner),groups,guide:scope?await readScopeWithDb(connection,scope,now):null,manual:manual??{total:0,marked:0},marked:marked?.total??0};
    });
    return result;
  });
}

export async function listGranularCountsWithDb(db: Pick<ProgressWriteDb,"getAllAsync">, ids: readonly string[]) {
  const pairs: [string,number][]=[];
  for(let offset=0;offset<ids.length;offset+=400) {
    const batch=ids.slice(offset,offset+400);
    const rows=await db.getAllAsync<{owner_id:string;marked:number}>(`SELECT owner_id,COUNT(*) AS marked FROM granular_decisions
      WHERE marked=1 AND owner_id IN (${batch.map(()=>"?").join(",")}) GROUP BY owner_id`,...batch);
    for(const row of rows) pairs.push([row.owner_id,row.marked]);
  }
  return Object.fromEntries(pairs);
}
