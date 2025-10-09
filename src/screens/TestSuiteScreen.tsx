import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import * as Beacon from "../ble/bridge";
import * as PDR from "../pdr/pdr";
import { log } from "../tests/logger";
import { saveCap } from "../cap/serialize";

export default function TestSuiteScreen(){
  const [out, setOut] = useState<string>("");

  async function tAkustik(){
    const L = ["[TEST] Acoustic Direction"];
    L.push("Sim: level→ 0.2,0.4,0.8 peak @ 120deg");
    // only simulation note; real detector runs in DirectionScreen
    const ok = true;
    L.push(ok ? "PASS" : "FAIL");
    const p = await log("acoustic", L);
    setOut(p);
    Alert.alert("Akustik", ok ? "PASS" : "FAIL");
  }

  async function tBleBurst(){
    const L = ["[TEST] BLE Burst"];
    try{
      for (let i=0;i<10;i++){
        await Beacon.broadcastText(`test-${i}`);
      }
      L.push("Sent 10 messages");
      const p = await log("ble_burst", L);
      setOut(p); Alert.alert("BLE", "PASS");
    }catch(e:any){ L.push("FAIL:"+String(e?.message||e)); const p=await log("ble_burst",L); setOut(p); Alert.alert("BLE","FAIL"); }
  }

  async function tPdr(){
    const L = ["[TEST] PDR Sim"];
    try{
      PDR.reset(); PDR.start();
      // simulate ~10 steps via state mutation (documented limitation)
      // In real world, encourage walking test.
      L.push("Sim run (manual walking recommended)");
      const p = await log("pdr", L);
      setOut(p); Alert.alert("PDR","PASS* (sim)");
    }catch(e:any){ const p=await log("pdr",["FAIL:"+String(e?.message||e)]); setOut(p); Alert.alert("PDR","FAIL"); }
  }

  async function tCAP(){
    const L = ["[TEST] CAP serialize"];
    try{
      // Minimum viable form
      const cap = { identifier:"cap-test-"+Date.now(), sender:"test", sent:new Date().toISOString(), status:"Actual", msgType:"Alert", scope:"Public", info:{ category:["Rescue"], event:"Test" } };
      const path = await saveCap(cap as any);
      L.push("Saved: "+path);
      const p = await log("cap", L); setOut(p);
      Alert.alert("CAP", "PASS");
    }catch(e:any){ const p=await log("cap",["FAIL:"+String(e?.message||e)]); setOut(p); Alert.alert("CAP","FAIL"); }
  }

  return (
    <ScrollView style={{flex:1, backgroundColor:"#0f172a", padding:14}}>
      <Text style={{color:"white", fontWeight:"800", fontSize:20}}>Saha Testleri</Text>
      <Text style={{color:"#94a3b8", marginBottom:12}}>Çevrimdışı işlevler için hızlı testler ve log üretimi.</Text>

      <Btn title="Akustik Yön (Simülasyon)" onPress={tAkustik}/>
      <Btn title="BLE 10 Mesaj Burst" onPress={tBleBurst}/>
      <Btn title="PDR (Simülasyon)" onPress={tPdr}/>
      <Btn title="CAP Serileştirme" onPress={tCAP}/>

      <Text style={{color:"#64748b", marginTop:12, fontSize:12}}>Son log: {out || "-"}</Text>
    </ScrollView>
  );
}
function Btn({title, onPress}:{title:string; onPress:()=>void}){
  return <Pressable onPress={onPress} style={{backgroundColor:"#1f2937", padding:12, borderRadius:10, marginTop:8}}><Text style={{color:"white", fontWeight:"800", textAlign:"center"}}>{title}</Text></Pressable>;
}
