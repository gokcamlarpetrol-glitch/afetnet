import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { p2pLocalSend } from "../p2p/send";

const DIR="/tmp/voice/";

export async function recordVoice(id:string){
  await FileSystem.makeDirectoryAsync(DIR,{intermediates:true}).catch(()=>{});
  const rec=new Audio.Recording();
  await rec.prepareToRecordAsync({
    android: {
      extension: '.m4a',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
    },
    ios: {
      extension: '.m4a',
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.LOW,
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 128000,
    },
  });
  await rec.startAsync();
  (recordVoice as any)._rec=rec; (recordVoice as any)._id=id;
}
export async function stopVoice(){
  const rec=(recordVoice as any)._rec; if(!rec) {return;}
  await rec.stopAndUnloadAsync();
  const uri=rec.getURI(); const id=(recordVoice as any)._id;
  const b64=await FileSystem.readAsStringAsync(uri,{encoding:"base64" as any});
  const chunk={ id:"voice_"+id, kind:"voice_note", ts:Date.now(), data:b64.slice(0,4000) }; // trimmed demo
  await p2pLocalSend(chunk);
  (recordVoice as any)._rec=null;
}
