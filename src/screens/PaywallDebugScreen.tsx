import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { iapService, PremiumPlanId } from '../services/iapService';

export default function PaywallDebugScreen(){
  const [products, setProducts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(()=>{ (async()=>{
    try{
      setStatus("Initializing IAP...");
      await iapService.initialize();
      const ps = await iapService.getAvailableProducts();
      setProducts(ps);
      setStatus(`Loaded ${ps.length} products`);
    }catch(e:any){ setStatus(e?.message || "Init failed"); }
  })(); },[]);

  async function onPurchase(id: PremiumPlanId){
    if (busy) {return;}
    setBusy(true);
    try{
      setStatus(`Purchasing ${id}...`);
      const ok = await iapService.purchasePlan(id);
      setStatus(ok? "Purchase OK":"Purchase failed");
    }catch(e:any){ setStatus(e?.message||"Error"); Alert.alert("Hata", e?.message||"Satın alma olmadı"); }
    setBusy(false);
  }

  async function onRestore(){
    if (busy) {return;}
    setBusy(true);
    try{
      setStatus("Restoring...");
      const ok = await iapService.restorePurchases();
      setStatus(ok? "Restore OK":"Restore failed");
    }catch(e:any){ setStatus(e?.message||"Error"); }
    setBusy(false);
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:'#0f172a', padding:14 }}>
      <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>Paywall Debug</Text>
      <Text style={{ color:'#94a3b8', marginBottom:10 }}>{status}</Text>

      {products.map((p:any)=> (
        <View key={p.productId} style={{ backgroundColor:'#111827', borderRadius:12, padding:12, marginBottom:10 }}>
          <Text style={{ color:'white', fontWeight:'700' }}>{p.title || p.productId}</Text>
          <Text style={{ color:'#94a3b8' }}>{p.description}</Text>
          <Text style={{ color:'#10b981', marginTop:4 }}>{p.price || ''}</Text>
          <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
            <Pressable onPress={()=>onPurchase(p.productId)} style={{ backgroundColor:'#22c55e', padding:10, borderRadius:10 }}>
              <Text style={{ color:'white', fontWeight:'700' }}>Purchase</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable onPress={onRestore} style={{ backgroundColor:'#3b82f6', padding:12, borderRadius:10 }}>
        <Text style={{ color:'white', fontWeight:'700', textAlign:'center' }}>Restore Purchases</Text>
      </Pressable>
    </ScrollView>
  );
}



