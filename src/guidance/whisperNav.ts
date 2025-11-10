import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

let snd: Audio.Sound | null = null;
let on=false;

export async function startWhisper(level:'low'|'mid'|'high'='low'){
  if(on) {return;} on=true;
  try{
    const { sound } = await Audio.Sound.createAsync(
      // very short, very low-volume loop (replace with asset); only tone cue
      { uri: 'data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAA==' },
      { shouldPlay:true, isLooping:true, volume: level==='low'? 0.05 : level==='mid'? 0.12 : 0.2 },
    );
    snd = sound;
  }catch{
    // Ignore audio creation errors
  }
}
export async function stopWhisper(){ try{ await snd?.stopAsync(); await snd?.unloadAsync(); }catch{
  // Ignore audio stop errors
} snd=null; on=false; }

export async function pulseHaptic(seq: 'slow'|'fast'='slow'){
  const times = seq==='slow'? 3 : 6;
  for(let i=0;i<times;i++){ await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); await new Promise(r=>(globalThis as any).setTimeout(r, seq==='slow'? 800: 300)); }
}



