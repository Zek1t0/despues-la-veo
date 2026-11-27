import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { editorialClock } from "../../core/granularCoverage";

/** Sample the wall clock only. The UI recomputes from its cached evidence. */
export function useGranularDay(indexAt?: number | null, snapshotAt?: number | null) {
  const [sample,setSample]=useState(()=>({indexAt,snapshotAt,...editorialClock(new Date(),indexAt,snapshotAt)}));
  const clock=sample.indexAt===indexAt && sample.snapshotAt===snapshotAt
    ? sample : editorialClock(new Date(),indexAt,snapshotAt);
  useEffect(()=>{
    let timer: ReturnType<typeof setTimeout>;
    const refresh=()=>{
      clearTimeout(timer);
      const current=editorialClock(new Date(),indexAt,snapshotAt);
      setSample(previous=>previous.day===current.day && previous.current===current.current &&
        previous.indexAt===indexAt && previous.snapshotAt===snapshotAt
        ? previous : {indexAt,snapshotAt,...current});
      timer=setTimeout(refresh,current.delay);
    };
    refresh();
    const state=AppState.addEventListener("change",value=>{if(value==="active")refresh();});
    if(typeof window!=="undefined")window.addEventListener("focus",refresh);
    if(typeof document!=="undefined")document.addEventListener("visibilitychange",refresh);
    return ()=>{
      clearTimeout(timer);state.remove();
      if(typeof window!=="undefined")window.removeEventListener("focus",refresh);
      if(typeof document!=="undefined")document.removeEventListener("visibilitychange",refresh);
    };
  },[indexAt,snapshotAt]);
  return clock;
}
