import React from "react";
import { View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

type P = { x:number; y:number };
export default function TrailOverlay({ pts, speeds, w, h }:{ pts:P[]; speeds:number[]; w:number; h:number }){
  if (pts.length<2) {return <View style={{position:"absolute", left:0, top:0, width:w, height:h}}/>;}
  const chunks: { path:string; color:string }[] = [];
  // speed color thresholds (m/s): <0.8 green, <1.6 orange, else red
  const col = (v:number)=> v<0.8?"#22c55e88" : v<1.6?"#f59e0b88" : "#ef444488";
  // Build small polylines per segment color
  for(let i=1;i<pts.length;i++){
    const c = col(speeds[i-1]||0);
    const path = `${pts[i-1].x},${pts[i-1].y} ${pts[i].x},${pts[i].y}`;
    chunks.push({ path, color: c });
  }
  return (
    <View style={{position:"absolute", left:0, top:0, width:w, height:h, pointerEvents:"none"}}>
      <Svg width={w} height={h}>
        {chunks.map((c,idx)=>(<Polyline key={idx} points={c.path} stroke={c.color} strokeWidth={3} fill="none" />))}
      </Svg>
    </View>
  );
}



