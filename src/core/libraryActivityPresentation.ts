import type { PortableActivityEvent } from "./libraryBackupV8";
const labels:Record<string,string>={canonicalTitle:"título",titles:"títulos alternativos",abbreviatedTitles:"abreviaturas",synopsis:"sinopsis",genres:"géneros",categories:"categorías",posterImages:"póster",bannerImages:"banner",publicRating:"puntuación pública",startDate:"fecha de estreno",endDate:"fecha de finalización",editorialStatus:"estado editorial",episodeCount:"episodios",episodeLengthMinutes:"duración por episodio",totalLengthMinutes:"duración",classification:"clasificación",ageRating:"clasificación de edad",ageRatingGuide:"guía de edad",nsfw:"marca de contenido",status:"estado personal",tags:"etiquetas personales",notes:"nota",personalRating:"puntuación personal",pin:"pin",title:"título"};
export function activityDescription(event: PortableActivityEvent) {
  if(event.kind==="added")return "Título añadido";
  if(event.kind==="manual-edit")return "Ficha manual editada";
  const fields=[...new Set(event.fields.map(field=>labels[field]??"otros datos"))];
  if(event.origin==="metadata")return fields.length?`Metadata actualizada: ${fields.join(", ")}`:"Metadata actualizada";
  if(fields.length>1)return `Cambios personales: ${fields.join(", ")}`;
  return ({status:"Estado personal modificado",tags:"Etiquetas actualizadas",notes:"Nota editada",personalRating:"Puntuación personal modificada",pin:"Pin modificado"} as Record<string,string>)[event.kind]??"Datos personales modificados";
}
/** Date grouping uses the device's current local zone; event identity and stored clock stay intact. */
export function activityDay(timestamp:number) {
  const date=new Date(timestamp);
  return {key:`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`,label:date.toLocaleDateString("es-AR",{year:"numeric",month:"long",day:"numeric"})};
}
export function activityRows<T extends {event:PortableActivityEvent}>(entries:readonly T[]) {
  const result:({kind:"day";key:string;label:string}|{kind:"event";key:string;entry:T})[]=[];let previous="";
  for(const entry of entries){const day=activityDay(entry.event.occurredAt);if(day.key!==previous){result.push({kind:"day",key:`day-${day.key}`,label:day.label});previous=day.key;}result.push({kind:"event",key:entry.event.id,entry});}
  return result;
}
