import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

function sleep(ms:number){ return new Promise(r=>(globalThis as any).setTimeout(r,ms)); }

/** Morse "SOS" = ... --- ...  (kısa=250ms, uzun=750ms, ara=250ms) */
async function runMorseTorch(ref: React.MutableRefObject<any|null>, setOn:(b:boolean)=>void, abort:()=>boolean){
  const dot=250, dash=750, gap=250, letterGap=750, wordGap=1500;
  async function onFor(ms:number){ setOn(true); await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); await sleep(ms); setOn(false); await sleep(gap); }
  async function S(){ await onFor(dot); await onFor(dot); await onFor(dot); await sleep(letterGap); }
  async function O(){ await onFor(dash); await onFor(dash); await onFor(dash); await sleep(letterGap); }
  while(!abort()){
    await S(); if(abort()) {break;}
    await O(); if(abort()) {break;}
    await S();
    await sleep(wordGap);
  }
}

export default function TorchSOSScreen(){
  const [on,setOn]=useState(false);
  const abortRef = useRef(false);

  useEffect(()=>{ return ()=>{ abortRef.current=true; }; },[]);

  return (
    <View style={{ flex:1, backgroundColor:on?'#ffffff':'#000000', alignItems:'center', justifyContent:'center' }}>
      <Text style={{ color:on?'#000':'#fff', fontSize:22, fontWeight:'900', marginBottom:10 }}>SOS FENER</Text>
      <View style={{ flexDirection:'row', gap:8 }}>
        <Pressable onPress={async ()=>{
          abortRef.current=false;
          await runMorseTorch({ current:null }, setOn, ()=>abortRef.current);
        }} style={{ backgroundColor:'#ef4444', padding:10, borderRadius:10 }}><Text style={{ color:'white', fontWeight:'800' }}>BAŞLAT</Text></Pressable>
        <Pressable onPress={()=>{ abortRef.current=true; setOn(false); }} style={{ backgroundColor:'#1f2937', padding:10, borderRadius:10 }}><Text style={{ color:'white' }}>DURDUR</Text></Pressable>
      </View>
      <Text style={{ color:on?'#111':'#94a3b8', marginTop:8, textAlign:'center' }}>Ekran yüksek parlaklık + fenerde SOS yanıp sönmesi. Gürültülü ortamlar için görsel sinyal.</Text>
    </View>
  );
}
