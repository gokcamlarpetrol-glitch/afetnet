import { Camera, CameraType } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

export type PhotoResult = { path: string; w?:number; h?:number };
export async function takePhoto(cameraRef: React.RefObject<any>): Promise<PhotoResult|null>{
  try{
    const perm = await Camera.requestCameraPermissionsAsync();
    if(perm.status!=="granted") {return null;}
    const shot = await cameraRef.current?.takePictureAsync({ quality: 0.8, exif: false, skipProcessing: true });
    if(!shot) {return null;}
    // move into evidence dir
    const dst = "/tmp/evidence/" + "ph_" + Date.now() + ".jpg";
    await FileSystem.moveAsync({ from: shot.uri, to: dst });
    try{ await MediaLibrary.saveToLibraryAsync(dst); }catch{}
    return { path: dst, w: shot.width, h: shot.height };
  }catch{ return null; }
}

export async function startAudio(): Promise<Audio.Recording|null>{
  try{
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const rec = new Audio.Recording();
    // @ts-ignore
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await rec.startAsync();
    return rec;
  }catch{ return null; }
}
export async function stopAudio(rec: Audio.Recording): Promise<{ path:string; dur?:number }|null>{
  try{
    await rec.stopAndUnloadAsync();
    const info = await rec.getURI();
    if(!info) {return null;}
    const dst = "/tmp/evidence/" + "au_" + Date.now() + ".m4a";
    await FileSystem.moveAsync({ from: info, to: dst });
    return { path: dst };
  }catch{ return null; }
}
