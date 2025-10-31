import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { isEpmOn, enableEPM, disableEPM, loadEpmState } from '../power/epm';
import { logger } from '../utils/productionLogger';

export default function PowerScreen(){
  const [on, setOn] = useState(false);
  const [loading, setLoading] = useState(false);
  
  useEffect(()=>{ 
    loadEpmState()
      .then(()=> setOn(isEpmOn()))
      .catch((error) => {
        logger.error('Failed to load EPM state:', error);
        Alert.alert('Hata', 'Güç modu durumu yüklenemedi.');
      });
  },[]);
  
  async function toggle(){
    if (loading) return;
    setLoading(true);
    try{
      if (isEpmOn()){ 
        await disableEPM(); 
        setOn(false);
        Alert.alert('Güç Modu', 'Acil güç modu kapatıldı.');
      } else { 
        await enableEPM(); 
        setOn(true);
        Alert.alert('Güç Modu', 'Acil güç modu açıldı. Pil ömrü optimize edildi.');
      }
    }catch(e:any){ 
      logger.error('Failed to toggle EPM:', e);
      Alert.alert('Güç', e?.message || 'İşlem başarısız oldu.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <View style={{ flex:1, backgroundColor:'#0f172a', padding:14 }}>
      <Text style={{ color:'white', fontWeight:'800', fontSize:20 }}>Acil Güç Modu</Text>
      <Text style={{ color:'#94a3b8', marginBottom:12 }}>Tarama daha seyrek, ekran daha loş. Pil ömrü ↑</Text>
      <Pressable onPress={toggle} disabled={loading} style={{ backgroundColor:loading?'#6b7280':on?'#ef4444':'#22c55e', padding:14, borderRadius:12 }}>
        <Text style={{ color:'white', fontWeight:'800', textAlign:'center' }}>{loading ? 'İşleniyor...' : on ? 'Kapat' : 'Aç'}</Text>
      </Pressable>
      <Text style={{ color:'#64748b', marginTop:10, fontSize:12 }}>Not: iOS/Android arka plan kısıtlamaları değişkendir; kritik görevlerde ekranı açık tutmak en güvenilir yöntemdir.</Text>
    </View>
  );
}



