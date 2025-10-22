import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Team, Approval, ApprovalType } from '../team/types';
import { listTeams, upsertTeam, listApprovals, upsertApproval } from '../team/store';
import { broadcastApproval } from '../team/p2p';
import { getDeviceShortId } from '../p2p/bleCourier';

function makeId(){ return 'appr_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

export default function TeamScreen(){
  const [teams,setTeams]=useState<Team[]>([]);
  const [apps,setApps]=useState<Approval[]>([]);
  const [name,setName]=useState('');
  const [teamId,setTeamId]=useState('');
  const [quorum,setQuorum]=useState({ m:'2', n:'3' });

  async function load(){ setTeams(await listTeams()); setApps(await listApprovals()); }
  useEffect(()=>{ load(); },[]);

  async function createTeam(){
    if(!teamId.trim() || !name.trim()) { Alert.alert('Takım','Kimlik ve ad gerekli'); return; }
    const n = parseInt(quorum.n||'3',10), m = parseInt(quorum.m||'2',10);
    const me = await getDeviceShortId?.() || 'me';
    const t: Team = { teamId: teamId.trim(), name: name.trim(), members:[{ didShort: me }], quorum: { m: Math.min(m,n), n }, ts: Date.now() };
    await upsertTeam(t); setTeamId(''); setName(''); await load();
  }

  async function addMember(t:Team, didShort:string){
    const tmp = { ...t, members: [...t.members] };
    if(!tmp.members.some(m=>m.didShort===didShort)){ tmp.members.push({ didShort }); await upsertTeam(tmp); await load(); }
  }

  async function newApproval(t: Team, type: ApprovalType){
    const a: Approval = { id: makeId(), teamId: t.teamId, type, payload: {}, signers: [], status:'pending', createdTs: Date.now(), ttlSec: 24*3600 };
    await upsertApproval(a); await load();
  }

  async function sign(a: Approval){
    const me = await getDeviceShortId?.() || 'me';
    if(a.signers.includes(me)) { Alert.alert('Onay','Zaten imzalı'); return; }
    const upd = { ...a, signers: [...a.signers, me] };
    await upsertApproval(upd); await broadcastApproval(upd); await load();
  }

  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:12 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Takımlar & Onaylar</Text>

      <View style={{ backgroundColor:'#0b1220', padding:10, borderRadius:10, marginTop:10 }}>
        <Text style={{ color:'#e5e7eb', fontWeight:'700' }}>Yeni Takım</Text>
        <TextInput placeholder="Team ID" placeholderTextColor="#94a3b8" value={teamId} onChangeText={setTeamId} style={{ backgroundColor:'#111827', color:'white', padding:8, borderRadius:8, marginTop:6 }}/>
        <TextInput placeholder="Ad" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} style={{ backgroundColor:'#111827', color:'white', padding:8, borderRadius:8, marginTop:6 }}/>
        <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
          <TextInput placeholder="m (eşik)" placeholderTextColor="#94a3b8" keyboardType="number-pad" value={quorum.m} onChangeText={(v)=>setQuorum(s=>({ ...s,m:v }))} style={{ flex:1, backgroundColor:'#111827', color:'white', padding:8, borderRadius:8 }}/>
          <TextInput placeholder="n (üye)" placeholderTextColor="#94a3b8" keyboardType="number-pad" value={quorum.n} onChangeText={(v)=>setQuorum(s=>({ ...s,n:v }))} style={{ flex:1, backgroundColor:'#111827', color:'white', padding:8, borderRadius:8 }}/>
        </View>
        <Pressable onPress={createTeam} style={{ backgroundColor:'#2563eb', padding:10, borderRadius:8, marginTop:8 }}>
          <Text style={{ color:'white', textAlign:'center' }}>KAYDET</Text>
        </Pressable>
      </View>

      <Text style={{ color:'#e5e7eb', fontWeight:'700', marginTop:12 }}>Takımlar</Text>
      <FlatList
        data={teams}
        keyExtractor={t=>t.teamId}
        renderItem={({ item:t })=>(
          <View style={{ backgroundColor:'#111827', padding:10, borderRadius:10, marginTop:8 }}>
            <Text style={{ color:'white', fontWeight:'700' }}>{t.name} — {t.teamId}</Text>
            <Text style={{ color:'#94a3b8', fontSize:12 }}>Quorum: {t.quorum.m}/{t.quorum.n}</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:6 }}>
              {t.members.map(m=><Text key={m.didShort} style={{ color:'#93c5fd', backgroundColor:'#0b1220', paddingHorizontal:8, paddingVertical:4, borderRadius:6 }}>{m.didShort}</Text>)}
            </View>
            <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
              <Pressable onPress={()=>newApproval(t,'role_badge')} style={{ backgroundColor:'#1f2937', padding:8, borderRadius:8 }}><Text style={{ color:'white' }}>ROLE BADGE</Text></Pressable>
              <Pressable onPress={()=>newApproval(t,'task_grant')} style={{ backgroundColor:'#1f2937', padding:8, borderRadius:8 }}><Text style={{ color:'white' }}>TASK GRANT</Text></Pressable>
              <Pressable onPress={()=>newApproval(t,'zone_access')} style={{ backgroundColor:'#1f2937', padding:8, borderRadius:8 }}><Text style={{ color:'white' }}>ZONE ACCESS</Text></Pressable>
            </View>
            <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
              <TextInput placeholder="Üye DID kısa (örn: A1B2)" placeholderTextColor="#94a3b8" onSubmitEditing={async(e)=>{ await addMember(t, e.nativeEvent.text.trim()); }} style={{ flex:1, backgroundColor:'#0b1220', color:'white', padding:8, borderRadius:8 }}/>
            </View>
          </View>
        )}
      />

      <Text style={{ color:'#e5e7eb', fontWeight:'700', marginTop:12 }}>Onaylar</Text>
      <FlatList
        data={apps}
        keyExtractor={a=>a.id}
        renderItem={({ item:a })=>(
          <View style={{ backgroundColor:'#111827', padding:10, borderRadius:10, marginTop:8 }}>
            <Text style={{ color:'white', fontWeight:'700' }}>{a.type.toUpperCase()} — {a.teamId}</Text>
            <Text style={{ color:'#94a3b8', fontSize:12 }}>İmzalar: {a.signers.length} • Durum: {a.status}</Text>
            <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
              <Pressable onPress={()=>sign(a)} style={{ backgroundColor:'#2563eb', padding:8, borderRadius:8 }}>
                <Text style={{ color:'white' }}>İMZALA</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}



