import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import QRCode from "react-native-qrcode-svg";
import { SafeBarcodeScanner } from "../ui/SafeBarcodeScanner";
import * as Location from "expo-location";
import { loadGraph } from "../route/store";
import { routeAStar } from "../route/astar";
import { listHazards } from "../hazard/store";
import { buildShareFromPath, addReceived, SharedRoute } from "../route/share";
import { haversine } from "../geo/haversine";
import { sayKey } from "../voice/voice";

export default function RoutePlanScreen(){
  const [g,setG]=useState<any>({nodes:[],edges:[]});
  const [hz,setHz]=useState<any[]>([]);
  const [start,setStart]=useState<string|null>(null);
  const [end,setEnd]=useState<string|null>(null);
  const [path,setPath]=useState<string[]>([]);
  const [dist,setDist]=useState<number>(0);

  const BarcodeScannerComponent = useMemo(() => {
    if (SafeBarcodeScanner.isAvailable()) {
      return require('expo-barcode-scanner').BarCodeScanner;
    }
    return null;
  }, []);
  const [share,setShare]=useState<SharedRoute|null>(null);
  const [mode,setMode]=useState<"plan"|"share"|"scan"|"follow">("plan");
  const [follow,setFollow]=useState<SharedRoute|null>(null);
  const [remain,setRemain]=useState<number>(0);

  async function load(){ setG(await loadGraph()); setHz(await listHazards()); }
  useEffect(()=>{ load(); },[]);

  function sel(id:string){
    if(!start) {setStart(id);}
    else if(!end && id!==start) {setEnd(id);}
    else { setStart(id); setEnd(null); setPath([]); setDist(0); }
  }

  async function calc(){
    if(!start || !end){ Alert.alert("Nokta","Başlangıç/Bitiş seç"); return; }
    const r = routeAStar(g, start, end, hz);
    if(!r.ok){ Alert.alert("Rota","Bulunamadı"); return; }
    setPath(r.path); setDist(r.dist);
    await sayKey("route_ready", { km: (r.dist/1000).toFixed(2) });
  }

  async function onShare(){
    if(path.length<2) { Alert.alert("Rota","Önce rota hesapla"); return; }
    const sr = await buildShareFromPath(path, dist, g);
    setShare(sr); setMode("share");
  }

  async function onScan({ data }:any){
    try{
      const o = JSON.parse(data);
      if(o?.type!=="route_share") {return;}
      await addReceived(o);
      setFollow(o); setMode("follow");
    }catch{ Alert.alert("QR","Geçersiz veri"); }
  }

  async function updateRemain(){
    if(!follow) {return;}
    try{
      const p = await Location.getLastKnownPositionAsync({});
      if(!p) {return;}
      const me = { lat: p.coords.latitude, lng: p.coords.longitude };
      // kalan mesafe: me noktasından polyline'a proje + son segmentten sona
      let minIdx = 0, minD = Infinity;
      for(let i=0;i<follow.path.length;i++){
        const d = haversine(me, follow.path[i]);
        if(d<minD){ minD=d; minIdx=i; }
      }
      let rem = 0;
      for(let i=minIdx;i<follow.path.length-1;i++){
        rem += haversine(follow.path[i], follow.path[i+1]);
      }
      setRemain(rem);
    }catch{}
  }
  useEffect(()=>{ if(mode==="follow"){ const t = setInterval(async()=>{ await updateRemain(); if(remain>0){ await sayKey("route_remain", { meters: Math.round(remain) }); } }, 12000); return ()=>clearInterval(t); } },[mode,follow,remain]);

  const coords = useMemo(()=> path.map(id=>{ const n=g.nodes.find((x:any)=>x.id===id); return { latitude:n.lat, longitude:n.lng }; }), [path,g]);

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a" }}>
      <MapView style={{ flex:1 }} initialRegion={{ latitude:41.01, longitude:28.97, latitudeDelta:0.06, longitudeDelta:0.06 }}>
        {g.nodes.map((n:any)=><Marker key={n.id} coordinate={{ latitude:n.lat, longitude:n.lng }} title={n.label||n.id} pinColor={n.id===start?"#22c55e":n.id===end?"#ef4444":"#2563eb"} onPress={()=>sel(n.id)}/>)}
        {coords.length>=2 && <Polyline coordinates={coords} strokeWidth={5} />}
        {follow && <Polyline coordinates={follow.path.map(p=>({ latitude:p.lat, longitude:p.lng }))} strokeWidth={4} strokeColor="#fbbf24" />}
      </MapView>

      <View style={{ position:"absolute", left:12, right:12, bottom:12 }}>
        {mode==="plan" && (
          <View style={{ flexDirection:"row", gap:8, alignItems:"center" }}>
            <Pressable onPress={calc} style={{ backgroundColor:"#2563eb", padding:12, borderRadius:10 }}><Text style={{ color:"white", fontWeight:"800" }}>ROTA HESAPLA</Text></Pressable>
            <Pressable onPress={onShare} style={{ backgroundColor:"#1f2937", padding:12, borderRadius:10 }}><Text style={{ color:"white" }}>PAYLAŞ (QR/P2P)</Text></Pressable>
            <Pressable onPress={()=>setMode("scan")} style={{ backgroundColor:"#1f2937", padding:12, borderRadius:10 }}><Text style={{ color:"white" }}>QR TARA</Text></Pressable>
            <Text style={{ color:"white" }}>{dist? `${(dist/1000).toFixed(2)} km` : ""}</Text>
          </View>
        )}

        {mode==="share" && share && (
          <View style={{ backgroundColor:"#0b1220", padding:12, borderRadius:12, alignItems:"center" }}>
            <Text style={{ color:"white", fontWeight:"800" }}>Rota Paylaş (QR)</Text>
            <QRCode value={JSON.stringify(share)} size={220}/>
            <Pressable onPress={()=>setMode("plan")} style={{ backgroundColor:"#1f2937", padding:8, borderRadius:8, marginTop:10 }}>
              <Text style={{ color:"white" }}>Kapat</Text>
            </Pressable>
          </View>
        )}

        {mode==="scan" && (
          <View style={{ height:260, borderRadius:12, overflow:"hidden" }}>
            {BarcodeScannerComponent ? (
              <BarcodeScannerComponent onBarCodeScanned={onScan} style={{ flex:1 }}/>
            ) : (
              <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
                <Text style={{color:'white'}}>Barcode Scanner not available</Text>
              </View>
            )}
          </View>
        )}

        {mode==="follow" && follow && (
          <View style={{ backgroundColor:"#0b1220", padding:12, borderRadius:12 }}>
            <Text style={{ color:"white", fontWeight:"800" }}>Rota Takip</Text>
            <Text style={{ color:"#93c5fd" }}>Kalan: {(remain/1000).toFixed(2)} km</Text>
            <Pressable onPress={()=>{ setFollow(null); setMode("plan"); }} style={{ backgroundColor:"#1f2937", padding:8, borderRadius:8, marginTop:8 }}>
              <Text style={{ color:"white" }}>Takibi Bitir</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
