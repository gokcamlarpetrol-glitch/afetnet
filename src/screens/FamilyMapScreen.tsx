import React, { useEffect, useState } from "react";
import MapView, { Marker } from "react-native-maps";
import { FamilyContact } from "../family/types";
import { loadFamily } from "../family/store";

export default function FamilyMapScreen(){
  const [list,setList]=useState<FamilyContact[]>([]);
  useEffect(()=>{ const t=setInterval(async()=> setList(await loadFamily()), 5000); return ()=>clearInterval(t); },[]);
  return (
    <MapView style={{ flex:1 }} initialRegion={{ latitude:39, longitude:35, latitudeDelta:6, longitudeDelta:6 }}>
      {list.filter(x=>x.qlat && x.qlng).map(x=>(
        <Marker key={x.id} coordinate={{ latitude:x.qlat!, longitude:x.qlng! }} title={x.name} description={x.relation||""} />
      ))}
    </MapView>
  );
}



