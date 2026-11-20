import React, { useRef, useState } from "react";
import { View } from "react-native";
import { OrganizationButton, OrganizationCard, OrganizationInput, OrganizationText } from "./OrganizationUI";
import { space } from "../../theme/presentation";
import { generateManualEntryIdentity } from "../../core/manualEntryIdentity";
import { parseRecommendationCapture, recommendationTitle, recommendationsShareReference, type Recommendation, type RecommendationCapture } from "../../core/recommendationInbox";
import { createRecommendation, editRecommendation } from "../../storage/recommendationInboxRepo";
export function RecommendationForm({ recommendation, others, busy, run, done, review }: {
  recommendation?: Recommendation; others: Recommendation[]; busy: boolean;
  run: (action:()=>Promise<void>)=>Promise<boolean>; done:(id?:string)=>void; review:(id:string)=>void;
}) {
  const [name,setName]=useState(recommendation?.name??""),[url,setUrl]=useState(recommendation?.url??"");
  const [person,setPerson]=useState(recommendation?.person??""),[origin,setOrigin]=useState(recommendation?.origin??""),[comment,setComment]=useState(recommendation?.comment??"");
  const [showReference,setShowReference]=useState(!!recommendation?.reference);
  const [provider,setProvider]=useState(recommendation?.reference?.provider??""),[namespace,setNamespace]=useState(recommendation?.reference?.resourceNamespace??""),[externalId,setExternalId]=useState(recommendation?.reference?.externalId??"");
  const intent=useRef(recommendation?.id??generateManualEntryIdentity().replace(/^manual-/,"recommendation-"));
  const draft:RecommendationCapture={name,url,person,origin,comment,reference:showReference?{provider,resourceNamespace:namespace,externalId}:null};
  let checked:RecommendationCapture|null=null;
  try{checked=parseRecommendationCapture(draft,true);}catch{/* Save reports validation without discarding the draft. */}
  const duplicates=checked?others.filter(v=>v.id!==recommendation?.id&&recommendationsShareReference(v,checked!)):[];
  return <OrganizationCard>
    <OrganizationText heading>{recommendation?"Editar recomendación":"Nueva recomendación"}</OrganizationText>
    <OrganizationText muted>Guardá un nombre, enlace o referencia. No se consulta ningún catálogo al escribir o pegar.</OrganizationText>
    <OrganizationInput label="Nombre (opcional)" value={name} onChangeText={setName} editable={!busy}/>
    <OrganizationInput label="Enlace HTTP(S) (opcional)" value={url} onChangeText={value=>{setUrl(value);setShowReference(false);}} editable={!busy} autoCapitalize="none" keyboardType="url"/>
    <OrganizationInput label="Persona (opcional)" value={person} onChangeText={setPerson} editable={!busy}/>
    <OrganizationInput label="Dónde te lo recomendaron (opcional)" placeholder="WhatsApp, Discord, YouTube…" value={origin} onChangeText={setOrigin} editable={!busy}/>
    <OrganizationInput label="Comentario (opcional)" value={comment} onChangeText={setComment} editable={!busy} multiline/>
    <OrganizationButton label={showReference?"Ocultar referencia explícita":"Referencia de catálogo (opcional)"} expanded={showReference} variant="quiet" disabled={busy} onPress={()=>setShowReference(v=>!v)}/>
    {showReference&&<View style={{gap:space.sm}}>
      <OrganizationInput label="Proveedor de la referencia" value={provider} onChangeText={setProvider} editable={!busy} autoCapitalize="none"/>
      <OrganizationInput label="Namespace de la referencia" value={namespace} onChangeText={setNamespace} editable={!busy} autoCapitalize="none"/>
      <OrganizationInput label="ID externo" value={externalId} onChangeText={setExternalId} editable={!busy} autoCapitalize="none"/>
    </View>}
    {!!checked?.reference&&<OrganizationText muted>Referencia reconocida: {checked.reference.provider}/{checked.reference.resourceNamespace}/{checked.reference.externalId}</OrganizationText>}
    {!!duplicates.length&&<View style={{gap:space.sm}}><OrganizationText>Ya hay {duplicates.length} recomendaciones con esta referencia. Podés guardar otra con su propio contexto.</OrganizationText>
      {duplicates.map(v=><OrganizationButton key={v.id} label={`Revisar ${recommendationTitle(v)}${v.person?` · ${v.person}`:""}`} variant="quiet" disabled={busy} onPress={()=>review(v.id)}/>)}</View>}
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:space.sm}}>
      <OrganizationButton label={busy?"Guardando…":"Guardar recomendación"} icon="checkmark-outline" variant="primary" disabled={busy} onPress={()=>void(async()=>{
        if(await run(()=>recommendation?editRecommendation(recommendation.id,draft):createRecommendation(intent.current,draft)))done(intent.current);
      })()}/>
      <OrganizationButton label="Cancelar" variant="quiet" disabled={busy} onPress={()=>done()}/>
    </View>
  </OrganizationCard>;
}
