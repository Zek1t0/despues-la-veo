export const GUIDE_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;
export const guideEvidenceCurrent = (checked: number, now: number) => now >= checked && now - checked < GUIDE_VALIDITY_MS;

export function editorialClock(now: Date, indexAt?: number | null, snapshotAt?: number | null) {
  const time=now.valueOf();
  const midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).valueOf();
  const boundaries=[midnight];
  for(const checked of [indexAt,snapshotAt]) {
    if(checked!=null)boundaries.push(checked,checked+GUIDE_VALIDITY_MS);
  }
  const next=Math.min(...boundaries.filter(boundary=>boundary>time));
  return { day:localCivilDay(now), current:indexAt!=null && snapshotAt!=null &&
    guideEvidenceCurrent(indexAt,time) && guideEvidenceCurrent(snapshotAt,time),
    delay:Math.max(1,Math.min(next-time,15_000)) };
}

export function civilDateLabel(value: string) {
  const [year,month,day]=value.split("-");
  return `${day}/${month}/${year}`;
}

export function localCivilDay(now: Date) {
  return [String(now.getFullYear()).padStart(4,"0"),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
}
export type Availability = "Estrenado" | "Anunciado" | "Hoy · hora desconocida" | "Desconocido" | "Retirado";
export function unitAvailability(date: string | null, retired: boolean, today: string): Availability {
  if (retired) return "Retirado";
  if (!date) return "Desconocido";
  return date < today ? "Estrenado" : date > today ? "Anunciado" : "Hoy · hora desconocida";
}
type CoverageUnit = { marked: boolean; availability: Availability; special: boolean };
export function scopeCoverage(units: readonly CoverageUnit[], mode: "manual" | "accredited" | "partial" | "stale") {
  const active = units.filter(unit=>unit.availability !== "Retirado");
  const ordinary = active.filter(unit=>!unit.special);
  const released = ordinary.filter(unit=>unit.availability==="Estrenado");
  const marked = active.filter(unit=>unit.marked).length;
  if (mode==="manual") return { label: `${marked} de ${active.length} en tu lista`, counted:marked, denominator:null, percent:null };
  if (mode==="accredited" && released.length && ordinary.every(unit=>unit.availability==="Estrenado" || unit.availability==="Anunciado")) {
    const count = released.filter(unit=>unit.marked).length;
    return { label: `${count} de ${released.length} estrenados`, counted:count, denominator:released.length, percent:Math.round(count*100/released.length) };
  }
  return { label: `${marked} marcados · ${active.length} conocidos · ${mode==="stale"?"Guía desactualizada":mode==="partial"?"Guía parcial":"Cobertura sin acreditar"}`, counted:marked, denominator:null, percent:null };
}
export function partitionGranularSelection<T>(items: readonly T[]) {
  return Array.from({length:Math.ceil(items.length/500)},(_,index)=>items.slice(index*500,(index+1)*500));
}

export function visibleGuideCoverage(guide: { structuralMode: "partial" | "stale" | "accredited"; checkedAt: number | null;
  members: readonly { number: number; marked: boolean; retired: boolean; airDate: string | null }[] }, season: number,
  clock: Pick<ReturnType<typeof editorialClock>, "day" | "current">) {
  const mode=guide.checkedAt!=null && !clock.current ? "stale" : guide.structuralMode;
  return scopeCoverage(guide.members.map(member=>({
    marked:member.marked, special:season===0 || member.number===0,
    availability:unitAvailability(member.airDate,member.retired,clock.day),
  })),mode);
}
