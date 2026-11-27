import { unitReferenceKey, parseBackupDecision, type BackupDecision, type BackupGroup, type BackupUnit,
  type GranularBackup, type GranularIssue, type UnitReference } from "../core/libraryBackupV11";
import { granularOrder } from "../core/granularTracking";
import { nextProgressTimestamp, type ProgressPosition } from "../core/personalProgress";
import { mutation, touch } from "./granularRepo";
import { identityWithDb } from "./personalProgressBackupImport";
import type { ProgressDatabase, ProgressReadDb, ProgressWriteDb } from "./personalProgressRepo";

type Kind = "group"|"unit";
type Entity = BackupGroup|BackupUnit;
type DecisionRow = { marked:number; consumed_on:string|null; updated_at:number; revision:number };
export type GranularConflict = { owner:string; unitId:string; title:string; group:string|null; coordinate:ProgressPosition;
  local:BackupDecision; incoming:BackupDecision; revision:number; identity:string };
export type GranularImport = { inserted:number; preservedEqual:number; issues:GranularIssue[]; conflicts:GranularConflict[]; changedIds:string[] };

const referenceParams=(r:UnitReference)=>[r.provider,r.parentNamespace,r.parentId,r.namespace,r.externalId];
const equality=(a:BackupDecision,b:BackupDecision)=>a.marked===b.marked && a.consumedOn===b.consumedOn;
const decisionValue=(itemId:string,unitId:string,row:DecisionRow):BackupDecision=>({
  itemId,unitId,marked:row.marked===1,consumedOn:row.consumed_on,updatedAt:row.updated_at,
});
async function listReferences(db: Pick<ProgressReadDb,"getAllAsync">, kind:Kind, owner?:string, id?:string) {
  return db.getAllAsync<UnitReference&{entity_id:string}>(`SELECT entity_id,provider,parent_namespace AS parentNamespace,parent_id AS parentId,
    namespace,external_id AS externalId FROM granular_${kind}_references ${owner===undefined?"":"WHERE owner_id=? AND entity_id=?"}
    ORDER BY provider,parent_namespace,parent_id,namespace,external_id`,...(owner===undefined?[]:[owner,id!]));
}
export async function readGranularBackup(db: ProgressReadDb):Promise<GranularBackup> {
  const schema=await db.getFirstAsync<{version:number}>("SELECT user_version AS version FROM pragma_user_version");
  const exists=await db.getFirstAsync("SELECT 1 FROM sqlite_master WHERE name='granular_units'");
  if(!exists) {
    if((schema?.version??0)>=10)throw Error("No se encontró el inventario granular.");
    return {enabled:[],groups:[],units:[],decisions:[]};
  }
  const groupRows=await db.getAllAsync<Omit<BackupGroup,"references">>("SELECT id,owner_id AS itemId,kind,label FROM granular_groups ORDER BY id");
  const unitRows=await db.getAllAsync<Omit<BackupUnit,"references"|"coordinate"|"retired">&{coordinate:string;retired:number}>(
    "SELECT id,owner_id AS itemId,group_id AS groupId,coordinate,label,retired FROM granular_units ORDER BY id");
  async function byEntity(kind:Kind) {
    const refs=new Map<string,UnitReference[]>();
    for(const {entity_id,...ref} of await listReferences(db,kind)){
      const values=refs.get(entity_id)??[];
      values.push(ref);refs.set(entity_id,values);
    }
    return refs;
  }
  const groupRefs=await byEntity("group"),unitRefs=await byEntity("unit");
  const decisions=await db.getAllAsync<DecisionRow&{owner_id:string;unit_id:string}>("SELECT * FROM granular_decisions ORDER BY unit_id");
  const flags=await db.getAllAsync<{owner_id:string}>("SELECT owner_id FROM granular_title_state WHERE enabled=1 ORDER BY owner_id");
  return {enabled:flags.map(row=>row.owner_id),
    groups:groupRows.map(row=>({...row,references:groupRefs.get(row.id)??[]})),
    units:unitRows.map(row=>({...row,coordinate:JSON.parse(row.coordinate),retired:row.retired===1,references:unitRefs.get(row.id)??[]})),
    decisions:decisions.map(row=>decisionValue(row.owner_id,row.unit_id,row))};
}

async function savepoint<T>(db:ProgressWriteDb, action:()=>Promise<T>):Promise<T> {
  await db.runAsync("SAVEPOINT granular_record");
  try{
    const value=await action();
    await db.runAsync("RELEASE SAVEPOINT granular_record");
    return value;
  }catch(error){
    await db.runAsync("ROLLBACK TO SAVEPOINT granular_record");
    await db.runAsync("RELEASE SAVEPOINT granular_record");
    throw error;
  }
}
type LocalEntity = { owner_id:string; group_id?:string|null; coordinate?:string; label:string|null; kind?:string; retired?:number };
async function getEntity(db:ProgressWriteDb,kind:Kind,id:string) {
  return db.getFirstAsync<LocalEntity>(`SELECT * FROM granular_${kind}s WHERE id=?`,id);
}
async function referenceTarget(db:ProgressWriteDb,kind:Kind,ref:UnitReference) {
  return db.getFirstAsync<{entity_id:string;owner_id:string}>(`SELECT entity_id,owner_id FROM granular_${kind}_references
    WHERE provider=? AND parent_namespace=? AND parent_id=? AND namespace=? AND external_id=?`,...referenceParams(ref));
}
function sourceKey(owner:string,id:string) { return JSON.stringify([owner,id]); }
async function invalidateEvidence(db:ProgressWriteDb,owner:string,season:number,ref:UnitReference,unitId:string,groupId:string|null,retired:boolean) {
  if(ref.provider!=="tmdb")return;
  await db.runAsync(`UPDATE granular_guide_snapshots SET status='stale',revision=revision+1
    WHERE owner_id=? AND series_id=? AND status='accredited' AND (
      EXISTS (SELECT 1 FROM json_each(payload,'$.members') member WHERE json_extract(member.value,'$.unitId')=?)
      OR (?=0 AND season=? AND EXISTS(SELECT 1 FROM granular_group_references g
        WHERE g.owner_id=? AND g.entity_id=? AND g.provider='tmdb' AND g.parent_namespace='tv'
          AND g.parent_id=? AND g.namespace='season' AND g.external_id=json_extract(payload,'$.guide.id')))
    )`,owner,ref.parentId,unitId,Number(retired),season,owner,groupId,ref.parentId);
}
async function mergeEntities(db:ProgressWriteDb, kind:Kind, records:readonly Entity[], titleMap:Map<string,string>, groups:Map<string,string>,
  result:GranularImport, changed:Set<string>) {
  type Plan={source:string; owner:string; target:string; value:Entity; groupId:string|null};
  const resolved=new Map<string,string>(), byTarget=new Map<string,Plan[]>();
  const rejectedSources=new Set<string>(), references=new Map<string,Set<string>>();
  const report=(reference:string,reason:string)=>result.issues.push({reference,reason});
  for(const value of records) {
    const source=sourceKey(value.itemId,value.id);
    try{
      const owner=titleMap.get(value.itemId);
      if(!owner)throw Error("Título sin destino efectivo.");
      const groupId="groupId" in value && value.groupId!==null ? groups.get(sourceKey(value.itemId,value.groupId)) : null;
      if(groupId===undefined)throw Error("Grupo sin destino efectivo.");
      const local=await getEntity(db,kind,value.id), candidates=new Set<string>();
      if(local){if(local.owner_id!==owner)throw Error("UUID ocupado por otro título.");candidates.add(value.id);}
      for(const ref of value.references){
        if(!await db.getFirstAsync(`SELECT 1 FROM media_provider_references
          WHERE saved_title_id=? AND provider=? AND resource_namespace=? AND external_id=?`,owner,ref.provider,ref.parentNamespace,ref.parentId))
          throw Error("Referencia de unidad sin propietario acreditado.");
        const match=await referenceTarget(db,kind,ref);
        if(match){if(match.owner_id!==owner)throw Error("Referencia ocupada por otro título.");candidates.add(match.entity_id);}
      }
      if(candidates.size>1)throw Error("UUID y referencias apuntan a destinos diferentes.");
      const target=[...candidates][0]??value.id;
      const plans=byTarget.get(target)??[];
      plans.push({source,owner,target,value,groupId});byTarget.set(target,plans);
      for(const ref of value.references){
        const key=unitReferenceKey(ref), targets=references.get(key)??new Set<string>();
        targets.add(target);references.set(key,targets);
      }
    }catch(error){rejectedSources.add(source);report(value.id,error instanceof Error?error.message:"Identidad irresoluble.");}
  }
  const sourceTargets=new Map<string,string>();
  for(const [target,plans] of byTarget)for(const plan of plans){
    const existing=sourceTargets.get(plan.source);
    if(existing&&existing!==target)rejectedSources.add(plan.source);
    sourceTargets.set(plan.source,target);
  }
  const content=(p:Plan)=>JSON.stringify([p.owner,p.groupId,p.value.references,
    "coordinate" in p.value ? [p.value.coordinate,p.value.retired,p.value.label] : [p.value.kind,p.value.label]]);
  for(const [target,plans] of byTarget){
    const first=plans[0], {owner,value,groupId}=first;
    if(plans.some(p=>rejectedSources.has(p.source)||content(p)!==content(first)||
      p.value.references.some(ref=>(references.get(unitReferenceKey(ref))?.size??0)>1))){
      report(target,"Candidatos granulares contradictorios; se omitieron sus dependencias.");continue;
    }
    try{
      const outcome=await savepoint(db,async()=>{
        const local=await getEntity(db,kind,target);
        if(local&&local.owner_id!==owner)throw Error("Propietario granular incompatible.");
        const divergent=!!local&&("coordinate" in value?
          local.group_id!==groupId||local.coordinate!==JSON.stringify(value.coordinate)||local.label!==value.label||local.retired!==Number(value.retired):
          local.kind!==value.kind||local.label!==value.label);
        if(!local){
          if("coordinate" in value)await db.runAsync("INSERT INTO granular_units VALUES(?,?,?,?,?,?,?,?,?,?)",
            target,owner,groupId,JSON.stringify(value.coordinate),value.label,...granularOrder(value.coordinate),Number(value.retired));
          else await db.runAsync("INSERT INTO granular_groups VALUES(?,?,?,?)",target,owner,value.kind,value.label);
        }
        let wrote=!local;
        for(const ref of value.references)if(!await referenceTarget(db,kind,ref)){
          await db.runAsync(`INSERT INTO granular_${kind}_references VALUES(?,?,?,?,?,?,?)`,owner,target,...referenceParams(ref));
          wrote=true;
          const coordinate=local?.coordinate?JSON.parse(local.coordinate) as ProgressPosition:"coordinate" in value?value.coordinate:undefined;
          if(coordinate?.mode==="season-episode" && "coordinate" in value)await invalidateEvidence(db,owner,coordinate.season,ref,target,local ? local.group_id??null : groupId,local ? local.retired===1 : value.retired);
          if(kind==="group"&&ref.provider==="tmdb"){
            await db.runAsync(`UPDATE granular_guide_snapshots SET status='stale',revision=revision+1 WHERE
              owner_id=? AND series_id=? AND status='accredited' AND json_extract(payload,'$.guide.id')=?`,owner,ref.parentId,ref.externalId);
          }
        }
        if(wrote)await touch(db,owner);
        return {wrote,divergent};
      });
      if(outcome.wrote)changed.add(owner);
      if(outcome.divergent)report(target,"Se conservaron los atributos granulares locales.");
      for(const p of plans)resolved.set(p.source,target);
    }catch(error){report(target,error instanceof Error?error.message:"No se pudo restaurar el registro.");}
  }
  return resolved;
}
async function decisionContext(db:ProgressWriteDb,owner:string,id:string) {
  const unit=await getEntity(db,"unit",id);
  if(unit?.owner_id!==owner||!unit.coordinate)throw Error("La unidad ya no pertenece al título.");
  const title=await identityWithDb(db,owner), refs=await listReferences(db,"unit",owner,id);
  const group=unit.group_id?await getEntity(db,"group",unit.group_id):null;
  const groupRefs=unit.group_id?await listReferences(db,"group",owner,unit.group_id):[];
  return {title:title.title,group:group?.label??null,coordinate:JSON.parse(unit.coordinate) as ProgressPosition,
    identity:JSON.stringify([title.key,unit,refs,group,groupRefs])};
}
async function readDecision(db:ProgressWriteDb,owner:string,id:string) {
  return db.getFirstAsync<DecisionRow>("SELECT marked,consumed_on,updated_at,revision FROM granular_decisions WHERE owner_id=? AND unit_id=?",owner,id);
}
async function writeDecision(db:ProgressWriteDb,value:BackupDecision,revision:number) {
  await db.runAsync(`INSERT INTO granular_decisions VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id,unit_id)
    DO UPDATE SET marked=excluded.marked,consumed_on=excluded.consumed_on,updated_at=excluded.updated_at,revision=excluded.revision`,
    value.itemId,value.unitId,Number(value.marked),value.consumedOn,value.updatedAt,revision);
  await touch(db,value.itemId);
}
export async function mergeGranularWithDb(db:ProgressWriteDb, data:GranularBackup, issues:GranularIssue[], titleMap:Map<string,string>):Promise<GranularImport> {
  const result:GranularImport={inserted:0,preservedEqual:0,issues:[...issues],conflicts:[],changedIds:[]}, changed=new Set<string>();
  const groups=await mergeEntities(db,"group",data.groups,titleMap,new Map(),result,changed);
  const units=await mergeEntities(db,"unit",data.units,titleMap,groups,result,changed);
  for(const source of new Set(data.enabled.map(id=>titleMap.get(id)))){
    if(!source){result.issues.push({reference:"Habilitación",reason:"Título sin destino efectivo."});continue;}
    try{
      const modified=await savepoint(db,async()=>{
        const result=await db.runAsync(`INSERT INTO granular_title_state VALUES(?,1,1)
          ON CONFLICT(owner_id) DO UPDATE SET enabled=1,revision=revision+1 WHERE enabled=0`,source);
        return !!result.changes;
      });
      if(modified)changed.add(source);
    }catch(error){result.issues.push({reference:source,reason:error instanceof Error?error.message:"No se pudo habilitar el seguimiento."});}
  }
  const targets=new Map<string,BackupDecision>(), blocked=new Set<string>();
  for(const decision of data.decisions){
    const unitId=units.get(sourceKey(decision.itemId,decision.unitId)), owner=titleMap.get(decision.itemId);
    if(!unitId||!owner){result.issues.push({reference:decision.unitId,reason:"Unidad sin destino efectivo; se omitió la decisión."});continue;}
    const next={...decision,itemId:owner,unitId}, previous=targets.get(unitId);
    if(previous&&!equality(previous,next)){blocked.add(unitId);continue;}
    if(!previous||next.updatedAt>previous.updatedAt)targets.set(unitId,next);
  }
  for(const [id,incoming] of targets){
    if(blocked.has(id)){result.issues.push({reference:id,reason:"Decisiones contradictorias para el mismo destino."});continue;}
    try{
      const local=await readDecision(db,incoming.itemId,id);
      if(local){
        const previous=decisionValue(incoming.itemId,id,local);
        if(equality(previous,incoming))result.preservedEqual++;
        else result.conflicts.push({owner:incoming.itemId,unitId:id,local:previous,incoming,revision:local.revision,...await decisionContext(db,incoming.itemId,id)});
      }else{
        await savepoint(db,()=>writeDecision(db,incoming,1));result.inserted++;changed.add(incoming.itemId);
      }
    }catch(error){result.issues.push({reference:id,reason:error instanceof Error?error.message:"No se pudo restaurar la decisión."});}
  }
  result.changedIds=[...changed];return result;
}
export function applyGranularConflict(conflict:GranularConflict,database?:ProgressDatabase,now=Date.now()) {
  return mutation(conflict.owner,database,async db=>{
    const local=await readDecision(db,conflict.owner,conflict.unitId);
    const current=await decisionContext(db,conflict.owner,conflict.unitId);
    const incoming=parseBackupDecision(conflict.incoming);
    if(!local||local.revision!==conflict.revision||current.identity!==conflict.identity||
      !equality(decisionValue(conflict.owner,conflict.unitId,local),conflict.local)||local.updated_at!==conflict.local.updatedAt||
      incoming.itemId!==conflict.owner||incoming.unitId!==conflict.unitId)throw Error("La decisión o identidad cambió. Volvé a importar antes de resolver.");
    const value={...incoming,updatedAt:nextProgressTimestamp(Math.max(local.updated_at,incoming.updatedAt),now)};
    const revision=nextProgressTimestamp(local.revision,0);
    await writeDecision(db,value,revision);
    return {value,changed:true};
  });
}
