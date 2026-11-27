import { createLibraryBackupV10, parseLibraryBackupV10, type ParsedLibraryBackupV10 } from "./libraryBackupV10";
import { civilConsumptionDate, granularUuid } from "./granularTracking";
import { parseProgressPosition, type ProgressPosition } from "./personalProgress";

export type UnitReference = { provider:string; parentNamespace:string; parentId:string; namespace:string; externalId:string };
type Identity = { itemId:string; id:string; references:UnitReference[] };
export type BackupGroup = Identity & { kind:"manual"|"season"|"volume"; label:string };
export type BackupUnit = Identity & { groupId:string|null; coordinate:ProgressPosition; label:string|null; retired:boolean };
export type BackupDecision = { itemId:string; unitId:string; marked:boolean; consumedOn:string|null; updatedAt:number };
export type GranularBackup = { enabled:string[]; groups:BackupGroup[]; units:BackupUnit[]; decisions:BackupDecision[] };
export type GranularIssue = { reference:string; reason:string };
export type ParsedLibraryBackupV11 = Omit<ParsedLibraryBackupV10,"version"> & { version:11; granular:GranularBackup; granularIssues:GranularIssue[] };

function object(value:unknown): Record<string,unknown> {
  if (!value || typeof value!=="object" || Array.isArray(value)) throw Error("Registro granular inválido.");
  return value as Record<string,unknown>;
}
function word(value:unknown):string {
  if(typeof value!=="string" || !value || value.trim()!==value || /[\u0000-\u001f\u007f-\u009f\u2028\u2029\uD800-\uDFFF]/u.test(value))throw Error("Texto granular inválido.");
  return value;
}
function label(value:unknown) {
  const result=word(value);
  if([...result].length>120)throw Error("Descriptor demasiado largo.");
  return result;
}
export const unitReferenceKey=(r:UnitReference)=>JSON.stringify([r.provider,r.parentNamespace,r.parentId,r.namespace,r.externalId]);
function identity(row:Record<string,unknown>):Identity {
  if(!Array.isArray(row.references))throw Error("Faltan referencias granulares.");
  const refs=new Map<string,UnitReference>();
  for(const value of row.references){
    const r=object(value);
    const ref={provider:word(r.provider),parentNamespace:word(r.parentNamespace),parentId:word(r.parentId),namespace:word(r.namespace),externalId:word(r.externalId)};
    refs.set(unitReferenceKey(ref),ref);
  }
  return {itemId:word(row.itemId),id:granularUuid(word(row.id)),references:[...refs.keys()].sort().map(key=>refs.get(key)!)};
}
export function parseBackupDecision(value:unknown):BackupDecision {
  const row=object(value);
  const consumedOn=row.consumedOn===undefined?null:row.consumedOn;
  if(typeof row.marked!=="boolean" || (consumedOn!==null && typeof consumedOn!=="string") ||
    (!row.marked && consumedOn!==null) || typeof row.updatedAt!=="number" || !Number.isSafeInteger(row.updatedAt) || row.updatedAt<0)
    throw Error("Decisión granular inválida.");
  return {itemId:word(row.itemId),unitId:granularUuid(word(row.unitId)),marked:row.marked,consumedOn:civilConsumptionDate(consumedOn),updatedAt:row.updatedAt};
}
function parseBlock(root:Record<string,unknown>) {
  const issues:GranularIssue[]=[];
  function records<T>(field:string,parse:(value:unknown)=>T):T[] {
    const raw=root[field];
    if(!Array.isArray(raw))throw Error(`Falta la lista granular ${field}.`);
    return raw.flatMap((value,index)=>{
      try{return [parse(value)];}
      catch(error){issues.push({reference:`${field} ${index+1}`,reason:error instanceof Error?error.message:"Registro inválido."});return [];}
    });
  }
  const enabled=[...new Set(records("enabled",word))];
  const groups=records<BackupGroup>("groups",value=>{
    const row=object(value), kind=row.kind;
    if(kind!=="manual"&&kind!=="season"&&kind!=="volume")throw Error("Tipo de grupo inválido.");
    const group=identity(row);
    if(group.references.some(ref=>ref.provider==="tmdb"&&(ref.parentNamespace!=="tv"||ref.namespace!=="season"||kind!=="season"||!validTmdbIds(ref))))throw Error("Referencia TMDB de temporada inválida.");
    return {...group,kind,label:label(row.label)};
  });
  const units=records<BackupUnit>("units",value=>{
    const row=object(value), coordinate=parseProgressPosition(row.coordinate);
    if(!coordinate||typeof row.retired!=="boolean")throw Error("Unidad granular inválida.");
    const unit=identity(row);
    if(unit.references.some(ref=>ref.provider==="tmdb"&&(ref.parentNamespace!=="tv"||ref.namespace!=="episode"||coordinate.mode!=="season-episode"||!validTmdbIds(ref))))throw Error("Referencia TMDB de episodio inválida.");
    return {...unit, groupId:row.groupId===null?null:granularUuid(word(row.groupId)),coordinate,label:row.label===null?null:label(row.label),retired:row.retired};
  });
  return {granular:{enabled,groups,units,decisions:records("decisions",parseBackupDecision)},granularIssues:issues};
}
function validTmdbIds(ref:UnitReference) {
  return [ref.parentId,ref.externalId].every(id=>/^[1-9]\d*$/.test(id)&&Number(id)<=2147483647);
}

export function parseLibraryBackupV11(text:string) {
  try {
    const root=object(JSON.parse(text));
    if(root.version!==11)throw Error("Se esperaba backup v11.");
    const block=parseBlock(object(root.granular));
    const historical=parseLibraryBackupV10(JSON.stringify({...root,version:10}));
    if(!historical.ok)return historical;
    return {ok:true as const,payload:{...historical.payload,version:11 as const,...block}};
  }catch(error){
    return {ok:false as const,error:{field:"root" as const,message:error instanceof Error?error.message:"Backup v11 inválido."}};
  }
}

export function createLibraryBackupV11(
  items:Parameters<typeof createLibraryBackupV10>[0], pins:Parameters<typeof createLibraryBackupV10>[1],
  appearance:Parameters<typeof createLibraryBackupV10>[2], exportedAt:string|undefined,
  extras:Parameters<typeof createLibraryBackupV10>[4]&{granular:GranularBackup}
) {
  const {granular,granularIssues}=parseBlock(object(extras.granular));
  const owners=new Set(items.map(item=>item.id));
  const groupOwners=new Map(granular.groups.map(group=>[group.id,group.itemId]));
  const unitOwners=new Map(granular.units.map(unit=>[unit.id,unit.itemId]));
  if(granularIssues.length || groupOwners.size!==granular.groups.length || unitOwners.size!==granular.units.length ||
    granular.enabled.some(id=>!owners.has(id)) || granular.groups.some(g=>!owners.has(g.itemId)) ||
    granular.units.some(u=>!owners.has(u.itemId)||(u.groupId!==null&&groupOwners.get(u.groupId)!==u.itemId)) ||
    granular.decisions.some(d=>unitOwners.get(d.unitId)!==d.itemId) || new Set(granular.decisions.map(d=>d.unitId)).size!==granular.decisions.length)
    throw Error("El snapshot granular contiene datos inválidos o dependencias ausentes.");
  return {...createLibraryBackupV10(items,pins,appearance,exportedAt,extras),version:11 as const,granular};
}
