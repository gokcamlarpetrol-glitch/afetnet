import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, RefreshControl, ScrollView, Platform } from "react-native";
import MapView, { UrlTile, Marker, PROVIDER_DEFAULT, Circle, Polyline } from "react-native-maps";
import { readInbox, MapSignal } from "../p2p/inboxReader";
import { ageBucket } from "../geo/coarse";
import { useAlerts } from "../state/alertsStore";
import { haversineLatLng } from "../geo/proximity";
import { listInbox } from "../msg/store";
import { readAgg } from "../logistics/overlay";
import { listConflicts } from "../logistics/conflicts";
import { listTasks } from "../tasks/store";
import { centerOfCell } from "../geo/grid";
import { listHazards } from "../hazard/store";
import { listReceived } from "../route/share";
import { listDrafts } from "../hazard/infer";
import { readTrail } from "../pdr/store";
import { listTriage } from "../triage/store";
import HeatmapLayer from "./HeatmapLayer";
import * as Location from "expo-location";

const INITIAL_REGION = {
  latitude: 41.015, longitude: 28.979, // Istanbul center as a sensible default
  latitudeDelta: 0.12, longitudeDelta: 0.12,
};

function colorFor(kind:"sos"|"status", age: ReturnType<typeof ageBucket>){
  if(kind === "sos"){
    if(age==="fresh") {return "#ff3b30";}
    if(age==="stale") {return "#ff6f61";}
    return "#ffaba3";
  }else{
    if(age==="fresh") {return "#2dd36f";}
    if(age==="stale") {return "#66dc99";}
    return "#a7efc4";
  }
}

export default function OfflineMap(){
  const [signals, setSignals] = useState<MapSignal[]>([]);
  const [sosMessages, setSosMessages] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const alerts = useAlerts();
  const [me,setMe] = useState<{lat:number;lng:number}|null>(null);
  const [agg,setAgg] = useState<any[]>([]);
  const [conflicts,setConflicts] = useState<any[]>([]);
  const [tasks,setTasks] = useState<any[]>([]);
  const [haz,setHaz] = useState<any[]>([]);
  const [sharedRoutes,setSharedRoutes]=useState<any[]>([]);
  const [draftHaz,setDraftHaz]=useState<any[]>([]);
  const [trail,setTrail]=useState<any[]>([]);
  const [tri,setTriage]=useState<any[]>([]);

  async function load(){
    const list = await readInbox();
    setSignals(list);
    // Load SOS messages
    const msgs = await listInbox();
    const sos = msgs.filter(m => m.kind === "sos" && typeof m.qlat === "number" && typeof m.qlng === "number");
    setSosMessages(sos);
    setAgg(await readAgg());
    setConflicts(await listConflicts());
    setTasks(await listTasks());
    setHaz(await listHazards());
    setSharedRoutes(await listReceived());
    setDraftHaz(await listDrafts());
    setTrail(await readTrail(200));
    setTriage(await listTriage());
  }
  useEffect(()=>{
    load();
    (async()=>{
      try{
        const p = await Location.getLastKnownPositionAsync({});
        if(p) {setMe({lat:p.coords.latitude,lng:p.coords.longitude});}
      }catch{}
    })();
  }, []);

  const clusters = useMemo(()=>{
    // very light grid cluster on quantized cells
    const grid: Record<string, {lat:number;lng:number;items:MapSignal[]}> = {};
    for(const s of signals){
      const lat = typeof s.qlat==="number" ? s.qlat : undefined;
      const lng = typeof s.qlng==="number" ? s.qlng : undefined;
      if(lat==null || lng==null) {continue;}
      if(alerts.showOnlyNearby && me){
        const d = haversineLatLng(me, {lat, lng});
        if(d > alerts.proximityMeters) {continue;}
      }
      const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
      if(!grid[key]) {grid[key] = { lat, lng, items: [] };}
      grid[key].items.push(s);
    }
    return Object.values(grid);
  }, [signals, alerts.showOnlyNearby, alerts.proximityMeters, me]);

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        rotateEnabled={false}
        pitchEnabled={false}
        initialRegion={INITIAL_REGION}
      >
        {/* Raster tiles served from bundled assets via file-url scheme.
           Example layout: assets/tiles/{z}/{x}/{y}.png  */}
        <UrlTile
          urlTemplate={"file:///android_asset/tiles/{z}/{x}/{y}.png"}
          zIndex={-1}
          maximumZ={16}
          tileSize={256}
        />
        {/* iOS local file loader alternative if needed:
            <UrlTile urlTemplate={`${FileSystem.documentDirectory}tiles/{z}/{x}/{y}.png`} /> */}

            {clusters.map((c, idx)=>{
              const newest = c.items.reduce((a,b)=> a.ts>b.ts?a:b);
              const age = ageBucket(newest.ts);
              const color = colorFor(newest.kind, age);
              const label = `${c.items.filter(i=>i.kind==="sos").length} SOS / ${c.items.filter(i=>i.kind==="status").length} OK`;
              return (
                <Marker
                  key={`${c.lat},${c.lng}-${idx}`}
                  coordinate={{ latitude: c.lat, longitude: c.lng }}
                  title={label}
                  description={`son: ${new Date(newest.ts).toLocaleString()}`}
                  pinColor={color}
                />
              );
            })}
            {/* SOS Messages */}
            {sosMessages.map((msg, idx)=>{
              if(alerts.showOnlyNearby && me){
                const d = haversineLatLng(me, {lat: msg.qlat!, lng: msg.qlng!});
                if(d > alerts.proximityMeters) {return null;}
              }
              return (
                <Marker
                  key={`sos-${msg.id}-${idx}`}
                  coordinate={{ latitude: msg.qlat!, longitude: msg.qlng! }}
                  title="🆘 SOS Mesaj"
                  description={`${msg.body} (${new Date(msg.ts).toLocaleTimeString()})`}
                  pinColor="#ef4444"
                />
              );
            })}

            {/* Logistics clusters as semi-transparent circles (heat-ish) */}
            {agg.map((a,idx)=>{
              const intensity = Math.min(1, a.total/10);
              const radius = 200 + Math.min(600, a.total*60);
              return (
                <Circle key={`lg_${a.key}_${idx}`}
                  center={{ latitude: a.glat, longitude: a.glng }}
                  radius={radius}
                  strokeColor="rgba(59,130,246,0.7)"
                  fillColor={`rgba(59,130,246,${0.15 + intensity*0.35})`}
                />
              );
            })}

            {/* Task markers (status color) */}
            {tasks.map((t,idx)=>{
              // try to find its logistics item approx location from samples cached in agg
              const cell = agg.find((a:any)=> a.samples.find((s:any)=> s.id===t.itemId));
              if(!cell) {return null;}
              const c = centerOfCell(cell.key);
              const color = t.status==="done" ? "#10b981" : t.status==="in_progress" ? "#f59e0b" : "#ef4444";
              return <Marker key={`task_${idx}`} coordinate={{ latitude:c.lat, longitude:c.lng }} title={`Görev: ${t.status}`} pinColor={color} />;
            })}

            {/* Conflict markers */}
            {conflicts.map((c,idx)=>{
              const center = centerOfCell(c.key);
              return <Marker key={`cf_${idx}`} coordinate={{ latitude:center.lat, longitude:center.lng }} title="Çakışma Uyarısı" description={`Aynı bölgede benzer ${c.cat} talepleri: ${c.count}`} pinColor="#fbbf24" />;
            })}

            {/* Hazard zones */}
            {haz.map((z,idx)=>(
              <Circle key={z.id}
                center={{ latitude:z.center.lat, longitude:z.center.lng }}
                radius={z.radius}
                strokeColor="rgba(239,68,68,0.8)"
                fillColor={ z.severity===1 ? "rgba(239,68,68,0.15)" : z.severity===2 ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.35)" }
              />
            ))}

            {/* Shared routes as thin polylines */}
            {sharedRoutes.map((sr,idx)=>(
              <Polyline key={`sr_${idx}`} coordinates={sr.path.map((p:any)=>({ latitude:p.lat, longitude:p.lng }))} strokeWidth={3} strokeColor="#fbbf24" />
            ))}

            {/* Draft hazard circles (pale) */}
            {draftHaz.map((z:any)=>(
              <Circle key={z.id}
                center={{ latitude:z.center.lat, longitude:z.center.lng }}
                radius={z.radius}
                strokeColor="rgba(234,179,8,0.6)"
                fillColor="rgba(234,179,8,0.18)"
              />
            ))}

            {/* PDR breadcrumb polyline */}
            {trail.length>=2 && <Polyline coordinates={trail.map((p:any)=>({ latitude:p.lat, longitude:p.lng }))} strokeWidth={2} strokeColor="#6b7280"/>}

            {/* Triage overlay (approx coords if present) */}
            {tri.map((t:any,idx:number)=> t.qlat && t.qlng ? (
              <Marker key={`tri_${idx}`} coordinate={{ latitude:t.qlat, longitude:t.qlng }} pinColor={t.cat==="RED"?"#ef4444":t.cat==="YELLOW"?"#f59e0b":t.cat==="GREEN"?"#10b981":"#6b7280"} />
            ): null)}

            {/* Heatmap overlay for recent signals */}
            <HeatmapLayer/>
      </MapView>
      <ScrollView
        style={styles.overlay}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async()=>{setRefreshing(true); await load(); setRefreshing(false);}}/>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { position:"absolute", top:0, left:0, right:0, height:40 }
});
