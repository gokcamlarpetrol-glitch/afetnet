import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { snapshot, cellCenter } from '../heat/heatstore';

export default function HeatGridOverlay({ w, h, center, scale }:{ w:number; h:number; center:{lat:number;lon:number}; scale:number }){
  // `scale`: px per meter near center; basit çizim: hücre merkezini ekrana projekte edip 120x120 px kare çiz
  const cells = snapshot();
  const items = cells.slice(0, 400); // güvenlik için sınırlı
  const toXY = (lat:number,lon:number)=>{
    const R=6378137; 
    const dx=(lon-center.lon)*Math.cos(center.lat*Math.PI/180)*Math.PI/180*R;
    const dy=(lat-center.lat)*Math.PI/180*R;
    return { x: w/2 + dx*scale, y: h/2 - dy*scale };
  };
  return (
    <View style={{ position:'absolute', left:0, top:0, width:w, height:h, pointerEvents:'none' }}>
      <Svg width={w} height={h}>
        {items.map((c,idx)=>{
          const { lat,lon } = cellCenter(c.k);
          const { x,y } = toXY(lat,lon);
          const size = 120; // px ~ 250m için ölçeklenebilir, MVP sabit
          const alpha = Math.max(0.15, Math.min(0.75, c.v/4));
          return <Rect key={idx} x={x-size/2} y={y-size/2} width={size} height={size} fill={`rgba(239,68,68,${alpha})`} />;
        })}
      </Svg>
    </View>
  );
}



