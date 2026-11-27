import { useEffect,useState } from "react";
import { ScrollView } from "react-native";
import * as SQLite from "expo-sqlite";
import { ensureLibrarySchema,enableAndVerifyForeignKeys } from "../../storage/databaseSchema";
import { backfillMetadataBaselinesWithDb } from "../../storage/mediaMetadataSchema";
import { getLibraryBackupExportData } from "../../storage/libraryBackupExport";
import { mergeLibraryBackup } from "../../storage/savedTitlesRepo";
import { createLibraryBackupV11 } from "../../core/libraryBackupV11";
import { parseLibraryBackup } from "../../core/libraryBackup";
import { downloadGranularGuide } from "../../storage/granularInventory";
import { listGranularUnits,setGranularDecisions } from "../../storage/granularRepo";
import { applyGranularConflict,type GranularImport } from "../../storage/granularBackup";
import { readGranularScreen } from "../../storage/granularPresentationRepo";
import { getSavedTitleWithReferencesByIdWithDb } from "../../storage/savedTitleStorage";
import { GranularPreview } from "../../components/granular/GranularPreview";
import { GranularScreen } from "../../components/granular/GranularScreen";
import { newGranularUuid } from "../../core/granularTracking";
import type { SavedTitleWithProviderReferences } from "../../core/savedTitle";
import { exportProgressReport } from "../../components/progress/exportProgressReport";
import { GranularImportReview } from "../../components/granular/GranularImportReview";
import { OrganizationButton as Button,OrganizationText as Label } from "../../components/organization/OrganizationUI";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { mediaReviewEnabled } from "./mode";

const scope={ownerId:"TEST-S4",seriesId:"1250",language:"es-AR",season:1};
const appearance={status:"unavailable",reason:"pending"} as const;
type Backup=ReturnType<typeof createLibraryBackupV11>;
type Fixture={a:SQLite.SQLiteDatabase;b:SQLite.SQLiteDatabase};
async function exportBackup(db:SQLite.SQLiteDatabase) {
  const data=await getLibraryBackupExportData(appearance,db);
  return createLibraryBackupV11(data.items,data.pins,appearance,undefined,data);
}
async function restore(db:SQLite.SQLiteDatabase,raw:Backup) {
  const parsed=parseLibraryBackup(JSON.stringify(raw));
  if(!parsed.ok)throw Error(parsed.error.message);
  return mergeLibraryBackup(parsed.payload,()=>{throw Error("Colisión TEST inesperada.");},db);
}

export default function GranularBackupReview() {
  const [fixture,setFixture]=useState<Fixture|null>(null), [raw,setRaw]=useState<Backup|null>(null);
  const [report,setReport]=useState<GranularImport|null>(null), [status,setStatus]=useState("Preparando dos bases SQLite TEST…");
  const [busy,setBusy]=useState(false);
  const [item,setItem]=useState<SavedTitleWithProviderReferences|null>(null);
  const [page,setPage]=useState<{source:string;season:number}|null>(null);
  const {theme}=useAppTheme();
  useEffect(()=>{
    if(!mediaReviewEnabled())return;
    let active=true;
    const handles:SQLite.SQLiteDatabase[]=[];
    void(async()=>{
      for(const name of ["media-review-granular-backup-a.db","media-review-granular-backup-b.db"]){
        const db=await SQLite.openDatabaseAsync(name);
        handles.push(db);await enableAndVerifyForeignKeys(db);await ensureLibrarySchema(db);
        await db.runAsync("DELETE FROM saved_titles WHERE id=?",scope.ownerId);
      }
      const [a,b]=handles;
      await a.withTransactionAsync(async()=>{
        await a.runAsync(`INSERT INTO saved_titles(id,medium,content_family,primary_format,title,status,tags_json,created_at,updated_at)
          VALUES(?,'audiovisual',NULL,'tv','TEST · Serie portable','watching','[]',1,1)`,scope.ownerId);
        await a.runAsync("INSERT INTO media_provider_references VALUES ('tmdb','tv','1250',?)",scope.ownerId);
        await backfillMetadataBaselinesWithDb(a);
      });
      await downloadGranularGuide(scope,new AbortController().signal,{db:a,validatedContract:true,fetch:async path=>
        path==="/tv/1250"?{id:1250,seasons:[{id:51,season_number:1,episode_count:3}]}:
          {id:51,season_number:1,episodes:[1,2,3].map(n=>({id:200+n,season_number:1,episode_number:n,air_date:"2024-01-01"}))}
      });
      const page=await listGranularUnits(scope.ownerId,3,null,a);
      await setGranularDecisions(scope.ownerId,page.revision,page.rows.map(row=>({unitId:row.id,marked:true,consumedOn:"2024-02-29",expectedRevision:null})),a);
      if(active){setFixture({a,b});setStatus("Bases A y B listas.");}
    })().catch(error=>{if(active)setStatus(String(error));});
    return()=>{active=false;for(const db of handles)void db.closeAsync();};
  },[]);
  async function run(task:()=>Promise<void>){
    if(busy)return;
    setBusy(true);try{await task();}catch(error){setStatus(error instanceof Error?error.message:"Falló TEST");}finally{setBusy(false);}
  }
  if(page&&fixture&&item)return <GranularScreen key={page.season} item={item} database={fixture.b} initialSource={page.source} initialSeason={page.season}/>;
  return <ScrollView style={{flex:1,backgroundColor:theme.global.background}} contentContainerStyle={{padding:20,gap:12,maxWidth:900,width:"100%",alignSelf:"center"}}>
    <Label heading prominent>TEST · Backup granular v11</Label>
    <Label>{status}</Label>
    {fixture&&<Button label="Exportar backup v11 TEST" disabled={busy} onPress={()=>void run(async()=>{
      const file=await exportBackup(fixture.a);setRaw(file);await exportProgressReport(file);setStatus("Exportado v11 de A.");
    })}/>}
    {fixture&&raw&&<Button label="Restaurar en base B" disabled={busy} onPress={()=>void run(async()=>{
      const result=await restore(fixture.b,raw);
      const view=await readGranularScreen(scope.ownerId,scope,fixture.b);
      setStatus(`B · ${view.guide?.coverage.label} · ${result.granular?.inserted} decisiones importadas`);
    })}/>}
    {fixture&&raw&&<Button label="Importar decisiones opuestas" disabled={busy} onPress={()=>void run(async()=>{
      const changed={...raw,granular:{...raw.granular,decisions:raw.granular.decisions.map(row=>({...row,marked:false,consumedOn:null}))}};
      const result=await restore(fixture.b,changed);
      const granular=result.granular;
      const episode=(position: NonNullable<typeof granular>["conflicts"][number]["coordinate"])=>"episode" in position?position.episode:0;
      setReport(granular?{...granular,conflicts:[...granular.conflicts].sort((a,b)=>episode(a.coordinate)-episode(b.coordinate))}:null);
      setStatus("Conflictos en B.");
    })}/>}
    {fixture&&report&&<Button label="Cambiar base de E3 TEST" disabled={busy} onPress={()=>void run(async()=>{
      const page=await listGranularUnits(scope.ownerId,3,null,fixture.b), row=page.rows[2];
      await setGranularDecisions(scope.ownerId,page.revision,[{unitId:row.id,marked:true,consumedOn:"2024-03-01",expectedRevision:row.revision??null}],fixture.b);
      setStatus("Se editó E3 en B.");
    })}/>}
    {fixture&&report&&<GranularImportReview report={report} apply={entry=>applyGranularConflict(entry,fixture.b)}
      exportReport={exportProgressReport} close={()=>setReport(null)}/>}
    {fixture&&raw&&!report&&!item&&<Button label="Restaurar sobre caché TEST" disabled={busy} onPress={()=>void run(async()=>{
      const {b}=fixture;
      await downloadGranularGuide(scope,new AbortController().signal,{db:b,validatedContract:true,fetch:async path=>
        path==="/tv/1250"?{id:1250,seasons:[{id:51,season_number:1,episode_count:12}]}:
          {id:51,season_number:1,episodes:Array.from({length:12},(_,i)=>({id:201+i,season_number:1,episode_number:i+1,air_date:"2024-01-01"}))}
      });
      const backup=await exportBackup(b), t1=backup.granular.groups[0];
      const ref=(namespace:string,externalId:string)=>({provider:"tmdb",parentNamespace:"tv",parentId:scope.seriesId,namespace,externalId});
      const t2={...t1,id:newGranularUuid(),label:"Temporada 2",references:[ref("season","52")]};
      const additions=[[1,13],[1,14],[1,15],[2,1]].map(([season,episode])=>({
        id:newGranularUuid(),itemId:scope.ownerId,groupId:season===1?t1.id:t2.id,retired:false,label:null,
        coordinate:{mode:"season-episode" as const,season,episode},references:[ref("episode",String(season*300+episode))],
      }));
      await restore(b,{...backup,granular:{...backup.granular,groups:[...backup.granular.groups,t2],
        units:[...backup.granular.units,...additions],decisions:[...backup.granular.decisions,...additions.slice(0,2).map((unit,i)=>({
          itemId:scope.ownerId,unitId:unit.id,marked:i===0,consumedOn:i===0?"2024-02-29":null,updatedAt:12,
        }))]}});
      setItem(await getSavedTitleWithReferencesByIdWithDb(b,scope.ownerId));
      setStatus("Restauración sobre caché lista.");
    })}/>}
    {fixture&&item&&<GranularPreview item={item} database={fixture.b} onOpen={(source,season)=>setPage({source,season})}/>}
  </ScrollView>;
}
