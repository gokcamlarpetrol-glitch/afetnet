import React, { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { listApprovals, listTeams } from '../team/store';
import { getDeviceShortId } from '../p2p/bleCourier';

export default function BadgesScreen(){
  const [list,setList]=useState<any[]>([]);
  async function load(){
    const me = await getDeviceShortId?.() || 'me';
    const apps = await listApprovals();
    const teams = await listTeams();
    const ok = apps.filter(a=>{
      const team = teams.find(t=>t.teamId===a.teamId);
      if(!team) {return false;}
      if(a.status!=='approved') {return false;}
      return a.signers.length >= team.quorum.m && a.payload?.didShort ? a.payload.didShort===me : true;
    });
    setList(ok);
  }
  useEffect(()=>{ const t=(globalThis as any).setInterval(load,4000); load(); return ()=>(globalThis as any).clearInterval(t); },[]);

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Rozetlerim (24s)</Text>
      <FlatList
        data={list}
        keyExtractor={i=>i.id}
        renderItem={({ item })=>(
          <View style={{ backgroundColor:'#111827', padding:10, borderRadius:10, marginTop:8 }}>
            <Text style={{ color:'#e5e7eb', fontWeight:'700' }}>{item.type.toUpperCase()}</Text>
            <Text style={{ color:'#93c5fd' }}>Takım: {item.teamId}</Text>
            {item.payload?.role && <Text style={{ color:'#cbd5e1' }}>Rol: {item.payload.role}</Text>}
            {item.payload?.taskId && <Text style={{ color:'#cbd5e1' }}>Görev: {item.payload.taskId}</Text>}
            {item.payload?.zoneId && <Text style={{ color:'#cbd5e1' }}>Bölge: {item.payload.zoneId}</Text>}
          </View>
        )}
      />
    </View>
  );
}



