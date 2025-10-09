import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { paramsFor } from "../profile/params";
import { useProfile } from "../state/profileStore";
import { getLang, t } from "../i18n/runtime";

const ROOT = "/tmp/afn_data/i18n/";

let enabled = true;
let volume = 1.0;

export function setVoiceEnabled(on:boolean){ enabled = on; }
export function setVoiceVolume(v:number){ volume = Math.max(0, Math.min(1, v)); }

async function tryPlayFile(key:string){
  const lang = getLang();
  const path = `${ROOT}${lang}/audio/voiceprompts/${key}.mp3`;
  const ex = await FileSystem.getInfoAsync(path);
  if(!ex.exists) {return false;}
  try{
    const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true, volume });
    await sound.playAsync(); setTimeout(()=>sound.unloadAsync().catch(()=>{}), 2000);
    return true;
  }catch{ return false; }
}

export async function sayKey(key:string, vars?:Record<string,string|number>){
  const prof = paramsFor(useProfile.getState().profile);
  if(!enabled || !prof.audioEnabled) {return;}
  if(await tryPlayFile(key)) {return;}
  try{
    const phrase = await t(key, vars);
    await Speech.speak(phrase, { language: getLang(), rate: 1.0, pitch: 1.0, volume });
  }catch{}
}
