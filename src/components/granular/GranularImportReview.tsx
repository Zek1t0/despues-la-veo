import { useCallback,useEffect,useRef,useState } from "react";
import { Platform,Text,View } from "react-native";
import { formatProgressConflictDate } from "../../core/progressConflictDate";
import { progressPositionLabel } from "../../core/personalProgressPresentation";
import { civilDateLabel } from "../../core/granularCoverage";
import type { BackupDecision } from "../../core/libraryBackupV11";
import type { GranularConflict, GranularImport } from "../../storage/granularBackup";
import { OrganizationButton as Button, OrganizationCard as Card, OrganizationError, OrganizationText as Label } from "../organization/OrganizationUI";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { space } from "../../theme/presentation";

const PAGE_SIZE=10;
const describe=(d:BackupDecision)=>`${d.marked?"Marcado":"Desmarcado"} · ${d.consumedOn?civilDateLabel(d.consumedOn):"Sin fecha de consumo"} · Modificado ${formatProgressConflictDate(d.updatedAt)}`;
export function GranularImportReview({ report, apply, exportReport, close }: {
  report:GranularImport; apply:(entry:GranularConflict)=>Promise<BackupDecision>; exportReport:(value:unknown)=>Promise<void>; close:()=>void;
}) {
  const {theme}=useAppTheme();
  const [page,setPage]=useState(0), [confirm,setConfirm]=useState<number|"close"|null>(null);
  const [resolved,setResolved]=useState<Record<number,"local"|BackupDecision>>({});
  const [busy,setBusy]=useState(false), [error,setError]=useState<string|null>(null);
  const locked=useRef(false),cancel=useRef<View>(null);
  const openers=useRef(new Map<number,View>()),closeButton=useRef<View>(null);
  const restoreFocus=useRef<View|null>(null);
  const entries=[...report.conflicts.map((entry,index)=>({entry,index})),...report.issues.map(issue=>({issue}))];
  const pending=report.conflicts.length-Object.keys(resolved).length;
  const omissions=report.issues.length;
  const dismiss=useCallback(()=>{
    if(locked.current || confirm===null)return;
    restoreFocus.current=confirm==="close"?closeButton.current:openers.current.get(confirm)??null;
    setConfirm(null);setError(null);
  },[confirm]);
  useEffect(()=>{
    if(confirm===null){
      restoreFocus.current?.focus();
      restoreFocus.current=null;
      return;
    }
    cancel.current?.focus();
    if(Platform.OS!=="web")return;
    const onKey=(event:KeyboardEvent)=>{
      if(event.key!=="Escape")return;
      event.preventDefault();event.stopPropagation();
      dismiss();
    };
    document.addEventListener("keydown",onKey,true);
    return ()=>document.removeEventListener("keydown",onKey,true);
  },[confirm,dismiss]);
  async function run(action:()=>Promise<void>){
    if(locked.current)return;
    locked.current=true;setBusy(true);setError(null);
    try { await action(); }
    catch(cause){setError(cause instanceof Error?cause.message:"No se pudo completar la revisión.");}
    finally{locked.current=false;setBusy(false);}
  }
  return <Card>
    <Label heading prominent>Revisión de marcas importadas</Label>
    <Label muted>Se conserva la decisión local por defecto. El informe es temporal. Al cerrar, los candidatos pendientes quedan sin aplicar.</Label>
    <Text accessibilityLiveRegion="polite" style={{color:theme.global.textPrimary}}>
      {pending} {pending===1?"conflicto pendiente":"conflictos pendientes"} · {omissions} {omissions===1?"omisión":"omisiones"}
    </Text>
    <Button label="Exportar informe granular completo" disabled={busy} onPress={()=>void run(()=>exportReport({granular:report,resolutions:resolved}))}/>
    {entries.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map((value,offset)=>{
      if("issue" in value)return <Label key={`omit-${page}-${offset}`} muted>Omitido · {value.issue.reference}: {value.issue.reason}</Label>;
      const {entry,index}=value;
      const label=progressPositionLabel(entry.coordinate);
      const groupLabel=(group:string|null)=>group && !(entry.coordinate.mode==="season-episode" &&
        group.trim().toLocaleLowerCase()===`temporada ${entry.coordinate.season}`) ? `${group} · ` : "";
      const descriptor=groupLabel(entry.group)+label;
      const duplicate=report.conflicts.some(other=>other!==entry && other.owner===entry.owner && progressPositionLabel(other.coordinate)===label &&
        groupLabel(other.group)+label===descriptor);
      return <Card key={entry.unitId}>
        <Label heading>{entry.title}</Label>
        <Label>{descriptor}{duplicate?` · ${entry.unitId}`:""}</Label>
        <Label>Local · {describe(entry.local)}</Label>
        <Label>Backup · {describe(entry.incoming)}</Label>
        {resolved[index]?<Label>{resolved[index]==="local"?"Se conservó la decisión local.":"Se aplicó la decisión del backup."}</Label>:<View style={{flexDirection:"row",flexWrap:"wrap",gap:space.sm}}>
          <Button label="Conservar marca local" disabled={busy||confirm!==null} onPress={()=>setResolved(previous=>({...previous,[index]:"local"}))}/>
          <Button label="Aplicar marca del backup" buttonRef={node=>{if(node)openers.current.set(index,node);else openers.current.delete(index);}}
            disabled={busy||confirm!==null} onPress={()=>setConfirm(index)}/>
        </View>}
        {confirm===index&&<View onAccessibilityEscape={dismiss} style={{gap:space.sm}}>
          <Label>¿Aplicar esta decisión del backup? Se comprobarán la identidad y la decisión local.</Label>
          <Button label="Cancelar aplicación granular" buttonRef={cancel} disabled={busy} onPress={dismiss}/>
          <Button label="Confirmar decisión granular" variant="primary" disabled={busy} onPress={()=>void run(async()=>{
            const decision=await apply(entry);
            setResolved(previous=>({...previous,[index]:decision}));setConfirm(null);
          })}/>
        </View>}
      </Card>;
    })}
    <OrganizationError error={error}/>
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:space.sm}}>
      {page>0&&<Button label="Página anterior de marcas" disabled={busy||confirm!==null} onPress={()=>setPage(p=>p-1)}/>}
      {(page+1)*PAGE_SIZE<entries.length&&<Button label="Página siguiente de marcas" disabled={busy||confirm!==null} onPress={()=>setPage(p=>p+1)}/>}
      <Button label="Cerrar informe granular" buttonRef={closeButton} disabled={busy||confirm!==null} onPress={()=>setConfirm("close")}/>
    </View>
    {confirm==="close"&&<View onAccessibilityEscape={dismiss} style={{gap:space.sm}}>
      <Label>¿Descartar el informe temporal? Los candidatos pendientes quedan sin aplicar.</Label>
      <Button label="Conservar informe granular" buttonRef={cancel} disabled={busy} onPress={dismiss}/>
      <Button label="Descartar informe granular" disabled={busy} onPress={close}/>
    </View>}
  </Card>;
}
