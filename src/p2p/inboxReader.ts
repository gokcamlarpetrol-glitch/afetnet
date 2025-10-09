import * as FileSystem from "expo-file-system";
import { ageBucket } from "../geo/coarse";

const DIR = "/tmp/";
const INBOX = DIR + "p2p.inbox.json";

export type MapSignal = {
  id: string;
  ts: number;
  kind: "sos"|"status";
  qlat?: number;
  qlng?: number;
  payload?: any;
};

export async function readInbox(): Promise<MapSignal[]>{
  const info = await FileSystem.getInfoAsync(INBOX);
  if(!info.exists) {return [];}
  try{
    const txt = await FileSystem.readAsStringAsync(INBOX);
    const data = JSON.parse(txt);
    const items = (data?.items ?? []) as any[];
    const acc: Record<string, MapSignal> = {};
    for(const it of items){
      if(!it?.id || !it?.ts) {continue;}
      const key = it.id;
      // prefer latest by same id
      const cur = acc[key];
      if(!cur || it.ts > cur.ts){
        const qlat = it.payload?.qlat ?? it.payload?.lat ?? undefined;
        const qlng = it.payload?.qlng ?? it.payload?.lng ?? undefined;
        acc[key] = {
          id: it.id,
          ts: it.ts,
          kind: (it.kind === "sos" ? "sos" : "status"),
          qlat,
          qlng,
          payload: it.payload
        };
      }
    }
    // filter expired
    return Object.values(acc).filter(x => ageBucket(x.ts) !== "expired");
  }catch{
    return [];
  }
}



