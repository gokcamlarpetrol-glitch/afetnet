import { Audio } from "expo-av";
let snd: Audio.Sound | null = null;
export async function playPingLoop(){
  try{
    await Audio.setAudioModeAsync({ playsInSilentModeIOS:true });
    snd = new Audio.Sound();
    // 500ms/500ms bip-bip döngüsü için kısa beep örneği: base64 encoded 1kHz sine (very short)
    const beep = "data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAA..."; // kısa gömülü örnek (placeholder çok kısa)
    await snd.loadAsync({ uri: beep });
    await snd.setIsLoopingAsync(true);
    await snd.playAsync();
  }catch{}
}
export async function stopPing(){ try{ await snd?.stopAsync(); await snd?.unloadAsync(); }catch{} snd=null; }



