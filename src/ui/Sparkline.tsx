import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export default function Sparkline({ data, w=180, h=40 }:{ data:number[]; w?:number; h?:number }){
  if (!data.length) {return <View style={{ width:w, height:h }}/>;}
  const max = Math.max(...data), min = Math.min(...data);
  const norm = data.map(v=> (v-min)/(max-min || 1));
  const step = w/Math.max(1, data.length-1);
  let d = `M 0 ${h - norm[0]*h}`;
  for (let i=1;i<norm.length;i++) {d += ` L ${i*step} ${h - norm[i]*h}`;}
  return (
    <View style={{ width:w, height:h }}>
      <Svg width={w} height={h}><Path d={d} stroke="white" strokeWidth="2" fill="none"/></Svg>
    </View>
  );
}



