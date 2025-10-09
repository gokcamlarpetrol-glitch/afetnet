import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, View, TextInput, Image } from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import * as Location from "expo-location";
import { addEdge, addNode, loadGraph, clearGraph, setNodeLabel, setNodePhoto, pickPhotoFromCamera, pickPhotoFromGallery } from "../route/store";
import { useRole } from "../state/roleStore";

export default function RouteEditorScreen(){
  const [g,setG]=useState<{nodes:any[];edges:any[]}>({nodes:[],edges:[]});
  const [sel,setSel]=useState<string|null>(null);
  const role = useRole();

  async function load(){ setG(await loadGraph()); }
  useEffect(()=>{ load(); },[]);

  async function addHere(){
    const p = await Location.getLastKnownPositionAsync({}); if(!p){ Alert.alert("Konum","Bulunamadı"); return; }
    const id = await addNode({ lat:p.coords.latitude, lng:p.coords.longitude }); setSel(id); await load();
  }
  async function linkTo(id:string){
    if(!sel){ setSel(id); return; }
    if(sel===id) {return;}
    await addEdge(sel, id); setSel(null); await load();
  }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a" }}>
      <MapView style={{ flex:1 }} initialRegion={{ latitude:41.01, longitude:28.97, latitudeDelta:0.05, longitudeDelta:0.05 }}>
        {g.nodes.map(n=>
          <Marker key={n.id} coordinate={{ latitude:n.lat, longitude:n.lng }} title={n.label||n.id} pinColor={sel===n.id?"#10b981":"#2563eb"} onPress={()=>linkTo(n.id)}>
            <Callout>
              <View style={{ width:220 }}>
                <Text style={{ fontWeight:"800" }}>{n.label||n.id}</Text>
                {n.photoUri ? <Image source={{ uri:n.photoUri }} style={{ width:200, height:100, marginVertical:6, borderRadius:8 }}/> : null}
                <TextInput placeholder="Etiket" placeholderTextColor="#666" defaultValue={n.label} onSubmitEditing={async(e)=>{ await setNodeLabel(n.id, e.nativeEvent.text.trim()); await load(); }} style={{ borderWidth:1, borderColor:"#ddd", padding:6, borderRadius:8 }}/>
                <View style={{ flexDirection:"row", gap:8, marginTop:6 }}>
                  <Pressable onPress={async()=>{ const u=await pickPhotoFromCamera(); if(u){ await setNodePhoto(n.id,u); await load(); } }} style={{ backgroundColor:"#1f2937", padding:6, borderRadius:8 }}><Text style={{ color:"white" }}>Foto (Kamera)</Text></Pressable>
                  <Pressable onPress={async()=>{ const u=await pickPhotoFromGallery(); if(u){ await setNodePhoto(n.id,u); await load(); } }} style={{ backgroundColor:"#1f2937", padding:6, borderRadius:8 }}><Text style={{ color:"white" }}>Foto (Galeri)</Text></Pressable>
                </View>
              </View>
            </Callout>
          </Marker>
        )}
      </MapView>
      {role.role==="volunteer" ? null : (
        <View style={{ position:"absolute", bottom:16, left:16, right:16, flexDirection:"row", gap:8, justifyContent:"space-between" }}>
          <Pressable onPress={addHere} style={{ backgroundColor:"#2563eb", padding:12, borderRadius:10 }}><Text style={{ color:"white", fontWeight:"800" }}>Nokta Ekle (Konumum)</Text></Pressable>
          <Pressable onPress={async()=>{ await clearGraph(); await load(); }} style={{ backgroundColor:"#ef4444", padding:12, borderRadius:10 }}><Text style={{ color:"white", fontWeight:"800" }}>Temizle</Text></Pressable>
        </View>
      )}
    </View>
  );
}
