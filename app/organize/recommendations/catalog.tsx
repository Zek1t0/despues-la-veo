import {OrganizationPage,OrganizationText} from "../../../src/components/organization/OrganizationUI";
import React from "react";
import {Stack,useLocalSearchParams} from "expo-router";
import {RecommendationCatalogSearch} from "../../(tabs)/buscar";
export default function RecommendationCatalogScreen(){
  const {recommendationId}=useLocalSearchParams<{recommendationId:string}>();
  if(typeof recommendationId!=="string"||!recommendationId.trim())return <OrganizationPage title="Buscar en catálogo"><OrganizationText>Abrí una recomendación para buscar su obra.</OrganizationText></OrganizationPage>;
  return <><Stack.Screen options={{title:"Buscar en catálogo"}}/><RecommendationCatalogSearch recommendationId={recommendationId}/></>;
}
