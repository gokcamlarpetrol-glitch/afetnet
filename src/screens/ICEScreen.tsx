import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View, ScrollView } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { loadICE, saveICE, ICE } from "../ice/store";

export default function ICEScreen() {
  const [data, setData] = useState<ICE | null>(null);
  const [edit, setEdit] = useState(false);
  const [txt, setTxt] = useState<any>({});

  useEffect(() => { (async () => { setData(await loadICE()); })(); }, []);

  async function onSave() {
    const d: ICE = {
      name: txt.name || "",
      blood: txt.blood?.trim(),
      allergies: txt.allergies?.trim(),
      meds: txt.meds?.trim(),
      contacts: (txt.cname || txt.cphone) ? [{ name: txt.cname || "", phone: txt.cphone || "" }] : []
    };
    await saveICE(d);
    setData(d);
    setEdit(false);
  }

  const wrap = { flex: 1, backgroundColor: "#0f172a", padding: 16 as const };

  if (edit) {
    return (
      <ScrollView style={wrap}>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "700", marginBottom: 10 }}>ICE Bilgileri</Text>
        {["name","blood","allergies","meds","cname","cphone"].map((k)=>(
          <TextInput key={k} placeholder={k} value={txt[k]||""} onChangeText={(v)=>setTxt({...txt,[k]:v})}
            placeholderTextColor="#94a3b8"
            style={{ backgroundColor:"#111827", color:"white", marginVertical:6, padding:12, borderRadius:10 }}/>
        ))}
        <Pressable onPress={onSave} style={{ backgroundColor:"#1f2937", padding:12, borderRadius:10, marginTop:8 }}>
          <Text style={{ color:"white", textAlign:"center" }}>Kaydet</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const payload = data ? JSON.stringify(data) : "{}";
  const minimal = data ? JSON.stringify({ n:data.name, b:data.blood }) : "{}";
  const value = payload.length <= 1400 ? payload : minimal;

  return (
    <View style={[wrap, { alignItems: "center", justifyContent: "center" }]}>
      {data ? (
        <>
          <Text style={{ color: "white", marginBottom: 10 }}>ICE: {data.name}</Text>
          <QRCode value={value} size={220} />
          <Pressable onPress={() => setEdit(true)} style={{ backgroundColor: "#1f2937", padding: 12, borderRadius: 10, marginTop: 12 }}>
            <Text style={{ color:"white" }}>Düzenle</Text>
          </Pressable>
        </>
      ) : (
        <Pressable onPress={() => setEdit(true)} style={{ backgroundColor: "#1f2937", padding: 12, borderRadius: 10 }}>
          <Text style={{ color:"white" }}>ICE Ekle</Text>
        </Pressable>
      )}
    </View>
  );
}



