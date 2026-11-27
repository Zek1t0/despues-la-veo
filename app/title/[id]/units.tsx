import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useAppTheme } from "../../../src/theme/AppThemeProvider";
import { View } from "react-native";
import type { SavedTitleWithProviderReferences } from "../../../src/core/savedTitle";
import { initDb } from "../../../src/storage/db";
import { getSavedTitleWithReferencesByIdWithDb } from "../../../src/storage/savedTitleStorage";
import { observeLibraryProjection } from "../../../src/storage/libraryInvalidation";
import { GranularScreen } from "../../../src/components/granular/GranularScreen";
import { granularHeading } from "../../../src/components/granular/GranularPreview";
import { OrganizationText } from "../../../src/components/organization/OrganizationUI";
import { space } from "../../../src/theme/presentation";

export default function UnitRoute() {
  const { id,source,season }=useLocalSearchParams<{id:string;source?:string;season?:string}>();
  const {theme}=useAppTheme();
  const [item,setItem]=useState<SavedTitleWithProviderReferences|null>();
  useEffect(()=>{
    setItem(undefined);
    if (typeof id!=="string") return;
    return observeLibraryProjection(async()=>getSavedTitleWithReferencesByIdWithDb(await initDb(),id),setItem,
      ids=>ids.includes(id),()=>setItem(null),true);
  },[id]);
  if (item?.id===id && item) return <><Stack.Screen options={{title:granularHeading(item)}} /><GranularScreen key={id} item={item} initialSource={source} initialSeason={Number(season)}/></>;
  return <View style={{flex:1,padding:space.lg,backgroundColor:theme.global.background}}>
    <Stack.Screen options={{title:"Seguimiento"}} />
    <OrganizationText>{item===null?"Título no disponible.":"Cargando título…"}</OrganizationText>
  </View>;
}
