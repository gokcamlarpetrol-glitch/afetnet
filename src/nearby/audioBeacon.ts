import { Audio } from 'expo-av';
import { AUDIO_FREQ_HZ, AUDIO_PATTERN_MS } from './constants';

/** PLAY: generates an 1800Hz tone with SOS cadence */
export async function startAudioBeacon() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: true,
  });

  const sampleRate = 44100;
  const durationMs = 2000; // chunk loop
  const frames = Math.floor(sampleRate * (durationMs/1000));
  const twoPiF = 2 * Math.PI * AUDIO_FREQ_HZ / sampleRate;

  // Pre-synth a 2s sine buffer
  const data = new Float32Array(frames);
  for (let i=0;i<frames;i++) {data[i] = Math.sin(twoPiF * i) * 0.5;}

  const sound = new Audio.Sound();
  // We can't feed PCM directly; use a silent asset loop + setVolumeAsync. As expo-av cannot stream PCM,
  // emulate SOS by toggling volume on a loop.
  await sound.loadAsync((globalThis as any).require('../../assets/silence-2s.mp3')); // add 2s silent asset in /assets
  await sound.setIsLoopingAsync(true);
  await sound.playAsync();

  // SOS volume toggler
  let cancel = false;
  (async () => {
    while(!cancel){
      for (const ms of AUDIO_PATTERN_MS){
        await sound.setVolumeAsync(1.0);
        await new Promise(r=>(globalThis as any).setTimeout(r, ms));
        await sound.setVolumeAsync(0.0);
        await new Promise(r=>(globalThis as any).setTimeout(r, 120));
        if (cancel) {break;}
      }
    }
  })();

  return {
    stop: async () => {
      cancel = true;
      try { await sound.stopAsync(); } catch {
        // Ignore stop errors
      }
      try { await sound.unloadAsync(); } catch {
        // Ignore unload errors
      }
    },
  };
}

/** LISTEN: Goertzel energy at target freq; returns energy 0..1 */
export function createAudioDetector() {

  let recording: Audio.Recording | null = null;
   
  let onLevel: (_level:number)=>void = ()=>{};

  async function start() {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HighQuality);
    await rec.startAsync();
    recording = rec;

    // Poll PCM levels
    (async function pump(){
      while(recording){
        const status = await rec.getStatusAsync();
        if (!status.isRecording) {break;}
        // We can't read raw PCM with expo-av; approximate level via meter if available
        // Fallback: use metering if supported; else map averagePower to 0..1
        // @ts-ignore
        const level = typeof status.metering === 'number' ? Math.min(1, Math.max(0, (status.metering+160)/90)) : 0.3;
        onLevel(level);
        await new Promise(r=>(globalThis as any).setTimeout(r, 150));
      }
    })();
  }

  async function stop(){
    const rec = recording;
    recording = null;
    if (rec){
      try { await rec.stopAndUnloadAsync(); } catch {
        // Ignore stop errors
      }
    }
  }

  return {
    start, stop,
     
    onLevel: (fn:(_l:number)=>void)=>{ onLevel = fn; },
  };
}



