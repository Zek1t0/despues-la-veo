import { backfillMetadataBaselinesWithDb } from "../../storage/mediaMetadataSchema";
import { useEffect, useState } from "react";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { View } from "react-native";

import * as SQLite from "expo-sqlite";
import { enableAndVerifyForeignKeys, ensureLibrarySchema } from "../../storage/databaseSchema";
import { getSavedTitleWithReferencesByIdWithDb } from "../../storage/savedTitleStorage";
import { GranularScreen } from "../../components/granular/GranularScreen";
import { GranularPreview } from "../../components/granular/GranularPreview";
import { setPersonalProgress } from "../../storage/personalProgressRepo";
import { PersonalProgressSection } from "../../components/progress/PersonalProgressSection";
import { OrganizationButton, OrganizationText } from "../../components/organization/OrganizationUI";
import { mediaReviewEnabled } from "./mode";
import type { SavedTitleWithProviderReferences } from "../../core/savedTitle";

export default function GranularReview() {
  const query=new URLSearchParams(typeof window==="undefined"?"":window.location.search);
  const params={size:query.get("size"),kind:query.get("kind")};
  const [show,setShow]=useState<{source:string;season:number}|null>(null);
  const {setScheme,effectiveScheme,theme}=useAppTheme();
  const [fixture,setFixture]=useState<{db:SQLite.SQLiteDatabase;item:SavedTitleWithProviderReferences}|null>(null);
  const [failure,setFailure]=useState<string|null>(null);
  useEffect(()=>{
    if(!mediaReviewEnabled())return;
    let active=true;
    let database:SQLite.SQLiteDatabase|undefined;
    void (async()=>{
      const size=[12,100,1000,5000].find(n=>String(n)===params.size)??12;
      const manga=params.kind==="manga";
      database=await SQLite.openDatabaseAsync("media-review-granular-s3.db");
      await enableAndVerifyForeignKeys(database);await ensureLibrarySchema(database);
      const db=database;
      await db.withTransactionAsync(async()=>{
        await db.runAsync("DELETE FROM saved_titles WHERE id='TEST-S3'");
        await db.runAsync(`INSERT INTO saved_titles(id,medium,content_family,primary_format,title,status,tags_json,created_at,updated_at)
          VALUES('TEST-S3',?,?,?,?, 'watching','[]',1,1)`,manga?"comic":"audiovisual",manga?"manga":null,manga?"webtoon":"tv",manga?"TEST · Capítulos de papel":"TEST · Temporadas de papel");
        if(!manga)await db.runAsync("INSERT INTO media_provider_references VALUES('tmdb','tv','1234','TEST-S3')");
        await db.runAsync(`WITH RECURSIVE seq(n) AS (VALUES (1) UNION ALL SELECT n+1 FROM seq WHERE n<?)
          INSERT INTO granular_units
          SELECT printf('00000000-0000-4000-8000-%012d',n),'TEST-S3',NULL,
            CASE WHEN ? THEN printf('{"mode":"chapter","chapter":"%d%s"}',n,CASE WHEN n=2 THEN '.5' ELSE '' END)
              ELSE printf('{"mode":"episode","episode":%d}',CASE WHEN n=1 THEN 1 ELSE n+3 END) END,
            NULL,CASE WHEN ? THEN 2 ELSE 0 END,0,CASE WHEN ? OR n=1 THEN n ELSE n+3 END,
            CASE WHEN ? AND n=2 THEN '500000' ELSE '000000' END,0 FROM seq`,size,Number(manga),Number(manga),Number(manga),Number(manga));
        if(query.get("race")==="1")await db.runAsync("INSERT INTO granular_groups VALUES ('00000000-0000-4000-8000-000000009999','TEST-S3','manual','Grupo TEST')");
        await backfillMetadataBaselinesWithDb(db);
      });
      const item=await getSavedTitleWithReferencesByIdWithDb(db,"TEST-S3");
      if(item&&active){
        const source=query.get("race")==="1"?new Proxy(db,{get(target,key){
          if(key==="getAllAsync")return async(sql:string,...params:unknown[])=>{
            if(sql.includes("coordinate IN"))await new Promise(resolve=>setTimeout(resolve,900));
            if(sql.includes("u.group_id IS ?") && params.includes("00000000-0000-4000-8000-000000009999")) {
              await new Promise(resolve=>setTimeout(resolve,650));throw Error("Fallo de lectura TEST del grupo.");
            }
            return (target.getAllAsync as (...args:unknown[])=>Promise<unknown>).call(target,sql,...params);
          };
          const value=Reflect.get(target,key);
          return typeof value==="function"?value.bind(target):value;
        }}):db;
        setFixture({db:source,item});
      }
    })().catch(error=>{if(active)setFailure(error instanceof Error?error.message:"Error TEST");});
    return ()=>{active=false;if(database)void database.closeAsync();};
  },[params.size,params.kind]);
  if(!fixture)return <OrganizationText>{failure?`Falló SQLite TEST. ${failure}`:"Cargando SQLite TEST…"}</OrganizationText>;
  const {db,item}=fixture;
  const fixtureGuide={validatedContract:query.get("contract")!=="partial",fetch:async (path:string)=>{
    if(path==="/tv/1234")return {id:1234,seasons:[{id:10,season_number:0,episode_count:1},{id:11,season_number:1,episode_count:12}]};
    const season=path.endsWith("/0")?0:1;
    return {id:10+season,season_number:season,episodes:Array.from({length:season?12:1},(_,i)=>({
      id:100+season*20+i,name:`TEST Unidad ${i+1}`,season_number:season,episode_number:i+1,
      air_date:i===11?"2099-01-01":"2020-01-01",overview:"TEST Sinopsis oculta",runtime:21
    }))};
  }};
  if(show)return <GranularScreen database={db} item={item} initialSource={show.source} initialSeason={show.season} fixtureGuide={fixtureGuide}/>;
  return <View style={{flex:1,backgroundColor:theme.global.background}}><View style={{maxWidth:700,width:"100%",alignSelf:"center",padding:16,gap:16}}>
    <OrganizationText heading prominent>{item.title}</OrganizationText>
    <PersonalProgressSection itemId={item.id} classification={item} save={intent=>setPersonalProgress(intent,db)} onRetry={()=>{}} onConfirmed={()=>{}}
      progress={{version:1,itemId:item.id,updatedAt:1,position:item.medium==="comic"?{mode:"chapter",chapter:"12.5"}:{mode:"season-episode",season:3,episode:10}}} />
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}><OrganizationButton label="Tema claro TEST" onPress={()=>void setScheme("light")}/><OrganizationButton label="Tema oscuro TEST" onPress={()=>void setScheme("dark")}/></View>
    <OrganizationText muted>Tema TEST: {effectiveScheme==="light"?"claro":"oscuro"}</OrganizationText>
    <GranularPreview database={db} item={item} fixtureGuide={fixtureGuide} onOpen={(source,season)=>setShow({source,season})}/>
    <OrganizationButton label="Abrir lista TEST" onPress={()=>setShow({source:"manual",season:0})}/>
  </View></View>;
}
