import type { MetadataRunManager } from "./metadataRunManager";
import type { RefreshDatabase } from "../storage/metadataRefreshRepo";
import { runSerializedStorageMutation } from "../storage/storageMutationQueue";
import { readActivityPageWithDb, type ActivityFilter, type ActivityCursor } from "../storage/libraryActivityRepo";
import { getSavedTitleWithReferencesByIdWithDb } from "../storage/savedTitleStorage";
import { subscribeLibraryActivity } from "../storage/libraryActivitySignals";
import { subscribeLibraryInvalidation } from "../storage/libraryInvalidation";

/** Pure local reads and the existing S5 run handle. Construction never starts a run. */
export function createLibraryUpdatesService(db: RefreshDatabase, runs: MetadataRunManager) {
  return {
    async status() {
      const latest=runs.getActive()?.getSnapshot()??await runs.latest();
      const completed=await runs.lastCompleted();
      return { latest, completedAt:completed?.finished_at??null };
    },
    start:()=>runs.start(), cancel:()=>runs.getActive()?.cancel(), subscribeRun:runs.subscribe,
    subscribeFeed(listener:()=>void) {
      const activity=subscribeLibraryActivity(listener),presentation=subscribeLibraryInvalidation(listener);
      return ()=>{activity();presentation();};
    },
    page:(filter:ActivityFilter,cursor?:ActivityCursor)=>runSerializedStorageMutation(async()=>{
      const page=await readActivityPageWithDb(db,filter,cursor);
      const titles=new Map<string,Awaited<ReturnType<typeof getSavedTitleWithReferencesByIdWithDb>>>();
      for(const event of page.events)if(!titles.has(event.itemId))titles.set(event.itemId,await getSavedTitleWithReferencesByIdWithDb(db,event.itemId));
      return {...page,events:page.events.flatMap(event=>{
        const item=titles.get(event.itemId);
        return item?[{event,item}]:[];
      })};
    }),
    item:(id:string)=>runSerializedStorageMutation(()=>getSavedTitleWithReferencesByIdWithDb(db,id)),
  };
}
export type LibraryUpdatesService=ReturnType<typeof createLibraryUpdatesService>;
export async function getLibraryUpdatesService():Promise<LibraryUpdatesService> {
  const [{initDb},{getProductMetadataRefresh}]=await Promise.all([import("../storage/db"),import("./productMetadataRefresh")]);
  const [db,product]=await Promise.all([initDb(),getProductMetadataRefresh()]);
  return createLibraryUpdatesService(db,product.runs);
}
