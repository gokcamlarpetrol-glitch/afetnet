import { SafeBackgroundService } from './SafeBackgroundService';
import { Platform } from 'react-native';

const options = {
  taskName: 'AfetNet',
  taskTitle: 'AfetNet aktif',
  taskDesc: 'Şebekesiz tarama ve röle çalışıyor',
  taskIcon: { name: 'ic_launcher', type: 'mipmap' as const },
  color: '#ef4444',
  linkingURI: 'afetnet://home',
  parameters: {},
};

let running = false;

export async function startForegroundNote(){
  if (Platform.OS !== 'android') {return;}
  if (running) {return;}
  running = true;
  await SafeBackgroundService.start(async ()=>{ /* idle loop */ await new Promise(()=>{}); }, options).catch(()=>{ running=false; });
}

export async function stopForegroundNote(){
  if (Platform.OS !== 'android') {return;}
  if (!running) {return;}
  running = false;
  try{ await SafeBackgroundService.stop(); }catch{
    // Ignore stop errors
  }
}

export function isRunning(){ return running; }
