import React, { useState } from "react";
import { Alert, ScrollView, Text, View, Pressable } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import JSZip from "jszip";
import { verify } from "../crypto/keys";
import * as Crypto from "expo-crypto";

export default function ZipPreviewScreen(){
  const [info,setInfo] = useState<{files:string[]; ok?:boolean; err?:string; shaOk?:boolean; sigOk?:boolean}>({files:[]});

  async function pick(){
    try{
      const res = await DocumentPicker.getDocumentAsync({ type: "application/zip" });
      if(res.canceled) {return;}
      const file = res.assets[0];
      const buf = await fetch(file.uri).then(r=>r.arrayBuffer());
      const zip = await JSZip.loadAsync(buf);
      const files = Object.keys(zip.files).sort();
      // Try to read manifest & signature
      const manStr = await zip.file("manifest.json")?.async("string");
      const sigStr = await zip.file("signature.json")?.async("string") || await zip.file("evidence_signature.json")?.async("string");
      if(!manStr || !sigStr){ setInfo({ files, err:"manifest.json veya signature.json bulunamadı" }); return; }
      const sigObj = JSON.parse(sigStr);
      const sha = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, manStr);
      const shaOk = (sigObj.sha256 === sha);
      const sigOk = verify(sigObj.pubKeyB64, sha, sigObj.sigB64);
      setInfo({ files, shaOk, sigOk, ok: shaOk && sigOk });
    }catch(e:any){
      setInfo({ files:[], err: e?.message || "ZIP açılamadı" });
    }
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:"#0f172a", padding:14 }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"800" }}>ZIP Önizleme & Doğrulama</Text>
      <Pressable onPress={pick} style={{ backgroundColor:"#1f2937", padding:12, borderRadius:10, marginTop:12 }}>
        <Text style={{ color:"white", textAlign:"center" }}>ZIP Seç</Text>
      </Pressable>
      {info.err && <Text style={{ color:"#f87171", marginTop:10 }}>{info.err}</Text>}
      {info.files.length>0 && (
        <View style={{ marginTop:12, backgroundColor:"#0b1220", padding:12, borderRadius:12 }}>
          <Text style={{ color:"white", fontWeight:"700" }}>Dosyalar</Text>
          {info.files.map(f=><Text key={f} style={{ color:"#cbd5e1" }}>• {f}</Text>)}
          <View style={{ height:8 }}/>
          {"shaOk" in info && <Text style={{ color: info.shaOk?"#22c55e":"#f87171" }}>Manifest SHA eşleşmesi: {info.shaOk?"✓":"×"}</Text>}
          {"sigOk" in info && <Text style={{ color: info.sigOk?"#22c55e":"#f87171" }}>İmza doğrulama: {info.sigOk?"✓":"×"}</Text>}
        </View>
      )}
    </ScrollView>
  );
}



