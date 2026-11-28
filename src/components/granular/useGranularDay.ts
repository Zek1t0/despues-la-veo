import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
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
    const web=Platform.OS==="web";
    const state=web ? null : AppState.addEventListener("change",value=>{if(value==="active")refresh();});
    const focusTarget=web && typeof window!=="undefined" &&
      typeof window.addEventListener==="function" && typeof window.removeEventListener==="function" ? window : null;
    const visibilityTarget=web && typeof document!=="undefined" &&
      typeof document.addEventListener==="function" && typeof document.removeEventListener==="function" ? document : null;
    focusTarget?.addEventListener("focus",refresh);
    visibilityTarget?.addEventListener("visibilitychange",refresh);
    return ()=>{
      clearTimeout(timer);state?.remove();
      focusTarget?.removeEventListener("focus",refresh);
      visibilityTarget?.removeEventListener("visibilitychange",refresh);
    };
  },[indexAt,snapshotAt]);
  return clock;
}
