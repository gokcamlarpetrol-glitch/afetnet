import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Task, makeId } from "../ops/types";
import { addTask, listTasks, updateTask } from "../ops/taskStore";
import { broadcastTask, broadcastTaskPatch } from "../ops/taskMesh";

export default function TasksScreen(){
  const [rows,setRows]=useState<Task[]>([]);
  const [title,setTitle]=useState(""); const [detail,setDetail]=useState("");
  const [prio,setPrio]=useState<Task["prio"]>("urgent");

  async function refresh(){ setRows((await listTasks()).sort((a,b)=> (prioRank(a.prio)-prioRank(b.prio)) || (b.updated-a.updated))); }
  useEffect(()=>{ refresh(); const t=setInterval(refresh,3000); return ()=>clearInterval(t); },[]);

  async function create(){
    const t: Task = { id: makeId("tsk"), title, detail, prio, assignees: [], status:"new", created: Date.now(), updated: Date.now() };
    await broadcastTask(t); setTitle(""); setDetail(""); refresh(); Alert.alert("Görev eklendi","Mesh'e duyuruldu");
  }

  async function setStatus(id:string, s:Task["status"]){ await broadcastTaskPatch(id, { status: s }); refresh(); }

  return (
    <View style={{ flex:1, backgroundColor:"#0f172a", padding:12 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>Görevler</Text>
      <View style={{ backgroundColor:"#0b1220", padding:10, borderRadius:12, marginTop:8 }}>
        <View style={{ flexDirection:"row", gap:8, flexWrap:"wrap" }}>
          {(["life","urgent","normal"] as Task["prio"][]).map(p=>(
            <Pressable key={p} onPress={()=>setPrio(p)} style={{ backgroundColor: prio===p? "#ef4444":"#1f2937", padding:8, borderRadius:8 }}>
              <Text style={{ color:"white" }}>{p}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput placeholder="Başlık" placeholderTextColor="#94a3b8" value={title} onChangeText={setTitle} style={{ backgroundColor:"#111827", color:"white", padding:8, borderRadius:8, marginTop:6 }}/>
        <TextInput placeholder="Detay" placeholderTextColor="#94a3b8" value={detail} onChangeText={setDetail} style={{ backgroundColor:"#111827", color:"white", padding:8, borderRadius:8, marginTop:6 }}/>
        <Pressable onPress={create} style={{ backgroundColor:"#2563eb", padding:10, borderRadius:10, marginTop:8 }}>
          <Text style={{ color:"white", textAlign:"center", fontWeight:"800" }}>OLUŞTUR</Text>
        </Pressable>
      </View>

      <FlatList
        style={{ marginTop:10 }}
        data={rows}
        keyExtractor={(x)=>x.id}
        renderItem={({item})=>(
          <View style={{ backgroundColor:"#111827", padding:10, borderRadius:10, marginBottom:8 }}>
            <Text style={{ color:"#e5e7eb", fontWeight:"700" }}>{item.title}</Text>
            <Text style={{ color:item.prio==="life"?"#ef4444": item.prio==="urgent"?"#f59e0b":"#93c5fd" }}>{item.prio.toUpperCase()} • {item.status}</Text>
            {!!item.detail && <Text style={{ color:"#cbd5e1" }}>{item.detail}</Text>}
            <View style={{ flexDirection:"row", gap:8, marginTop:6, flexWrap:"wrap" }}>
              {(["assigned","enroute","onsite","complete","cancelled"] as const).map(s=>(
                <Pressable key={s} onPress={()=>setStatus(item.id, s)} style={{ backgroundColor:"#1f2937", padding:6, borderRadius:8 }}>
                  <Text style={{ color:"white" }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      />
    </View>
  );
}
function prioRank(p:Task["prio"]){ return p==="life"?0: p==="urgent"?1:2; }



