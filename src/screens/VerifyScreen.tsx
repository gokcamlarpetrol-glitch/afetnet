import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View, Pressable } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { verify } from '../crypto/keys';
import * as Timechain from '../timechain/store';
import QRCode from 'react-native-qrcode-svg';
import { getPublicKeyB64 } from '../crypto/keys';
import { loadAttests, verifyAttest } from '../evidence/attest';
import { useAttestPolicy } from '../state/attestPolicy';

const EV_DIR = '/tmp/evidence/';

type Result = { packId:string; manifest:boolean; signature:boolean; chain:boolean; detail?:string };

export default function VerifyScreen(){
  const [packs,setPacks] = useState<string[]>([]);
  const [res,setRes] = useState<Result|null>(null);
  const [pub,setPub] = useState<string>('');

  async function load(){
    try{
      const entries = await FileSystem.readDirectoryAsync(EV_DIR);
      const ids = Array.from(new Set(entries.map(f=>f.split('_')[0]).filter(x=>x.startsWith('ev'))));
      setPacks(ids);
      setPub(await getPublicKeyB64());
    }catch{ setPacks([]); }
  }
  useEffect(()=>{ load(); },[]);

  async function check(id:string){
    try{
      const man = await FileSystem.readAsStringAsync(`${EV_DIR}${id}_manifest.json`);
      const sig = await FileSystem.readAsStringAsync(`${EV_DIR}${id}_signature.json`);
      const sigObj = JSON.parse(sig);
      const sha = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, man);
      const mOk = (sigObj.sha256 === sha);
      const vOk = verify(sigObj.pubKeyB64, sha, sigObj.sigB64);
      const ch = await Timechain.verifyChain(5000);

      // M-of-N compute:
      const att = await loadAttests(id);
      const uniqByPub = new Map<string, boolean>();
      let valid=0, total=0;
      for(const a of att){
        if(!uniqByPub.has(a.signerPubB64)){ total++; uniqByPub.set(a.signerPubB64,true); }
        if(a.packSha===sha && await verifyAttest(a)) {valid++;}
      }
      const M = useAttestPolicy.getState().thresholdM;
      setRes({ packId:id, manifest:mOk, signature:vOk, chain: ch.ok, detail: `Ekip onayı: ${valid}/${total} (M=${M})` });
    }catch(e:any){
      Alert.alert('Doğrulama', 'Paket doğrulanamadı: '+(e?.message||''));
    }
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:'#0f172a', padding:14 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Paket Doğrulama & Kimlik</Text>
      <Text style={{ color:'#94a3b8', marginBottom:10 }}>İmza (Ed25519), manifest SHA-256 ve timechain bütünlüğü.</Text>

      <View style={{ backgroundColor:'#0b1220', padding:12, borderRadius:12, marginBottom:12 }}>
        <Text style={{ color:'#e5e7eb', fontWeight:'700' }}>Cihaz Kamu Anahtarı</Text>
        {pub ? <View style={{ alignItems:'center', marginTop:8 }}>
          <QRCode value={pub} size={180}/>
          <Text style={{ color:'#93c5fd', marginTop:8, fontSize:12 }}>{pub.slice(0,32)}…</Text>
        </View> : <Text style={{ color:'#cbd5e1' }}>Anahtar hazırlanıyor…</Text>}
      </View>

      <Text style={{ color:'#e5e7eb', fontWeight:'700', marginBottom:8 }}>Paketler</Text>
      {packs.map(id=>(
        <View key={id} style={{ backgroundColor:'#111827', padding:10, borderRadius:10, marginBottom:8 }}>
          <Text style={{ color:'white', fontWeight:'700' }}>{id}</Text>
          <Pressable onPress={()=>check(id)} style={{ backgroundColor:'#1f2937', padding:8, borderRadius:8, marginTop:8 }}>
            <Text style={{ color:'white', textAlign:'center' }}>Doğrula</Text>
          </Pressable>
        </View>
      ))}

      {res && <View style={{ backgroundColor:'#0b1220', padding:12, borderRadius:12, marginTop:12 }}>
        <Text style={{ color:'white', fontWeight:'800' }}>Sonuç: {res.packId}</Text>
        <Text style={{ color: res.manifest?'#22c55e':'#f87171' }}>Manifest SHA eşleşmesi: {res.manifest ? '✓' : '×'}</Text>
        <Text style={{ color: res.signature?'#22c55e':'#f87171' }}>İmza doğrulama: {res.signature ? '✓' : '×'}</Text>
        <Text style={{ color: res.chain?'#22c55e':'#f87171' }}>Timechain bütünlüğü: {res.chain ? '✓' : '×'}</Text>
        <Text style={{ color:'#93c5fd' }}>{res.detail}</Text>
      </View>}
    </ScrollView>
  );
}
