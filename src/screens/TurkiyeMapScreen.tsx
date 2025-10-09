import React, { useEffect, useState } from "react";
import MapView, { LocalTile, Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import { Dimensions, Platform, Text, View } from "react-native";
import * as FileSystem from "expo-file-system";
import { TILE_ROOT } from "../map/tiles";
import { readTrail } from "../pdr/store";
import { listTriage } from "../triage/store";
import { readQuakes24h } from "../quake/store";
import MbTileOverlay from "../map/MbTileOverlay";
import QuakeHeatmapLayer from "../map/QuakeHeatmapLayer";
import MMIGridLayer from "../map/MMIGridLayer";
import FacilitiesLayer from "../map/FacilitiesLayer";
import ClosuresLayer from "../map/ClosuresLayer";
import DrawingsLayer from "../map/DrawingsLayer";

export default function TurkiyeMapScreen(){
  const [trail,setTrail]=useState<any[]>([]);
  const [tri,setTri]=useState<any[]>([]);
  const [quakes,setQuakes]=useState<any[]>([]);
  useEffect(()=>{
    const t=setInterval(async()=>{
      setTrail(await readTrail(300));
      setTri(await listTriage());
      setQuakes(await readQuakes24h());
    }, 3000);
    return ()=>clearInterval(t);
  },[]);

  const initial = { latitude: 39.0, longitude: 35.0, latitudeDelta: 12, longitudeDelta: 12 };

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a" }}>
      <MapView style={{ flex:1 }} initialRegion={initial} provider={PROVIDER_GOOGLE}>
        {/* MBTiles overlay */}
        <MbTileOverlay/>
        
        {/* MMI Grid Layer */}
        <MMIGridLayer/>
        
        {/* Facilities Layer */}
        <FacilitiesLayer/>
        
        {/* Closures Layer */}
        <ClosuresLayer/>
        
        {/* Drawings Layer */}
        <DrawingsLayer/>
        
        {/* Quake density heatmap */}
        <QuakeHeatmapLayer/>

        {/* PDR breadcrumb */}
        {trail.length>1 && <Polyline coordinates={trail.map((p:any)=>({ latitude:p.lat, longitude:p.lng }))} strokeWidth={2} />}

        {/* Triage markers */}
        {tri.map((t:any,idx:number)=> t.qlat && t.qlng ? (
          <Marker key={`tri_${idx}`} coordinate={{ latitude:t.qlat, longitude:t.qlng }} pinColor={t.cat==="RED"?"#ef4444":t.cat==="YELLOW"?"#f59e0b":t.cat==="GREEN"?"#10b981":"#6b7280"} />
        ): null)}

        {/* Quake overlay last 24h */}
        {quakes.map((q:any,idx:number)=>(
          <Marker key={`q_${idx}`} coordinate={{ latitude:q.lat, longitude:q.lng }} title={`M${q.mag.toFixed(1)}`} description={new Date(q.ts).toLocaleString()} pinColor={q.mag>=5?"#ef4444":q.mag>=4?"#f59e0b":"#93c5fd"} />
        ))}
      </MapView>
      <View style={{ position:"absolute", bottom:6, left:6, right:6, backgroundColor:"rgba(0,0,0,0.55)", padding:6, borderRadius:8 }}>
        <Text style={{ color:"#cbd5e1", fontSize:11, textAlign:"center" }}>
          Harita verisi © OpenStreetMap katkıda bulunanlar • Lisans: ODbL — Bu uygulama OSM verisini önbellekleyerek çevrimdışı sunar.
        </Text>
      </View>
    </View>
  );
}
