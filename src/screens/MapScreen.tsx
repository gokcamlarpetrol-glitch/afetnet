import React, { useEffect, useRef, useState } from "react";
import { View, Text, useWindowDimensions, Pressable, Alert } from "react-native";
import { useApp } from "../store/app";
import HeatOverlay from "./HeatOverlay";
import * as Beacon from "../ble/bridge";
import * as MB from "../offline/mbtiles";
import { openDbFromUri } from "../offline/mbtiles-server";
import { startMbtilesServer, stopMbtilesServer, localTileUrlTemplate } from "../offline/mbtiles-server";
import { toENU } from "../map/localproj";
import * as Location from "expo-location";
import { listPins } from "../map/pins";
import { listBetween, speedsFrom } from "../history/collector";
import TrailOverlay from "../ui/TrailOverlay";
import HeatGridOverlay from "../ui/HeatGridOverlay";

let ExpoMap: any = null;
try { ExpoMap = require("expo-maps").default; } catch {}

export default function MapScreen(){
  const { queue } = useApp();
  const { width, height } = useWindowDimensions();
  const [beacons, setBeacons] = useState<{x:number;y:number;w?:number}[]>([]);
  const [useLocal, setUseLocal] = useState(false);
  const [pins, setPins] = useState<any[]>([]);
  const [trail, setTrail] = useState<{x:number;y:number}[]>([]);
  const [speeds, setSpeeds] = useState<number[]>([]);
  const [center, setCenter] = useState<{lat:number;lon:number}|null>(null);

  useEffect(()=>{ 
    let origin: {lat0:number; lon0:number}|null = null;
    (async()=>{
      const { status } = await Location.requestForegroundPermissionsAsync();
      if(status==="granted"){
        const loc = await Location.getCurrentPositionAsync({});
        origin = { lat0: loc.coords.latitude, lon0: loc.coords.longitude };
      }
      Beacon.start({ onNearby:(list)=>{
        if(origin){
          const pts = list.filter(x=>x.lat!=null && x.lon!=null).slice(-50) as any[];
          const s = pts.map(p=>{ const enu = toENU(p.lat, p.lon, origin!); return { x: width/2 + enu.x/2, y: height/2 - enu.y/2, w:1 }; });
          setBeacons(s);
        } else {setBeacons([]);}
      }});
    })();
    return ()=>{ Beacon.stop(); };
  },[width,height]);

  async function onImportMbtiles(){
    try{
      const uri = await MB.pickMbtiles();
      await openDbFromUri(uri);
      await startMbtilesServer();
      setUseLocal(true);
      Alert.alert("Harita", "Yerel tile sunucusu aktif (localhost:17311).");
    }catch(e:any){
      if (String(e?.message) !== "cancelled") {Alert.alert("Harita","İçe aktarılamadı.");}
    }
  }

  useEffect(()=>()=>{ stopMbtilesServer(); },[]);

  async function refreshPins(){ setPins(await listPins()); }
  async function refreshTrail(hours=2){
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status!=="granted") {return;}
    const fix = await Location.getCurrentPositionAsync({}); 
    const ctr = { lat: fix.coords.latitude, lon: fix.coords.longitude };
    setCenter(ctr);
    const t1 = Date.now(), t0 = t1 - hours*3600*1000;
    const pts = await listBetween(t0,t1);
    const sp = speedsFrom(pts);
    const R=6378137; 
    const scale = 1/2; // px per meter
    const proj = (lat:number,lon:number)=>{
      const dx=(lon-ctr.lon)*Math.cos(ctr.lat*Math.PI/180)*Math.PI/180*R;
      const dy=(lat-ctr.lat)*Math.PI/180*R;
      return { x: width/2 + dx*scale, y: height/2 - dy*scale };
    };
    setTrail(pts.map(p=>proj(p.lat,p.lon))); setSpeeds(sp);
  }

  useEffect(()=>{ refreshPins(); refreshTrail(2); const t = setInterval(()=>refreshTrail(2), 60000); return ()=>clearInterval(t); },[width,height]);

  if(!ExpoMap){
    return (
      <View style={{flex:1, backgroundColor:"#0f172a"}}>
        <Text style={{color:"#94a3b8", padding:12}}>Harita modülü devre dışı. Aşağıda ısı katmanı örneği var.</Text>
        <View style={{flex:1}}/>
        <Pressable onPress={onImportMbtiles} style={{backgroundColor:"#1f2937", padding:14, margin:12, borderRadius:12}}>
          <Text style={{color:"white", fontWeight:"800", textAlign:"center"}}>.MBTILES İÇE AKTAR</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{flex:1}}>
      <ExpoMap style={{flex:1}}>
        {useLocal && (
          <ExpoMap.TileOverlay urlTemplate={localTileUrlTemplate()} zIndex={-1} maximumZ={18} flipY={false} />
        )}
      </ExpoMap>
      {/* Overlays */}
      {center && <HeatGridOverlay w={width} h={height} center={center} scale={1/2} />}
      {trail.length>1 && <TrailOverlay pts={trail} speeds={speeds} w={width} h={height} />}

      <Pressable onPress={onImportMbtiles} style={{position:"absolute", right:16, top:64, backgroundColor:"#111827", padding:10, borderRadius:10}}>
        <Text style={{color:"white", fontWeight:"800"}}>.MBTILES</Text>
      </Pressable>
      <Pressable onPress={()=>refreshTrail(2)} style={{position:"absolute", left:16, top:64, backgroundColor:"#111827", padding:10, borderRadius:10}}>
        <Text style={{color:"white"}}>2s</Text>
      </Pressable>
      <Pressable onPress={()=>refreshTrail(24)} style={{position:"absolute", left:16, top:106, backgroundColor:"#111827", padding:10, borderRadius:10}}>
        <Text style={{color:"white"}}>24s</Text>
      </Pressable>
      <Pressable onPress={()=>refreshTrail(9999)} style={{position:"absolute", left:16, top:148, backgroundColor:"#111827", padding:10, borderRadius:10}}>
        <Text style={{color:"white"}}>Tümü</Text>
      </Pressable>
    </View>
  );
}
