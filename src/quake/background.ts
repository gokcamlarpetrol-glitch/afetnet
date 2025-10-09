import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { pollQuakes } from "./fetchers";

export const QUAKE_TASK = "AFN_QUAKE_POLL";

TaskManager.defineTask(QUAKE_TASK, async()=>{
  try{ await pollQuakes(); return BackgroundFetch.BackgroundFetchResult.NewData; }
  catch{ return BackgroundFetch.BackgroundFetchResult.Failed; }
});

export async function startQuakeBackground(){
  await BackgroundFetch.registerTaskAsync(QUAKE_TASK, { minimumInterval: 5*60, stopOnTerminate:false, startOnBoot:true });
}
export async function stopQuakeBackground(){
  await BackgroundFetch.unregisterTaskAsync(QUAKE_TASK);
}



