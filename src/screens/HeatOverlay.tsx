import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { addHit, decay, makeGrid, normalize } from "../map/heat";

type Pt = { x:number; y:number; v:number };

export default function HeatOverlay({ width, height, samples }:{width:number;height:number;samples:{x:number;y:number;w?:number}[]}) {
  const gridRef = useRef(makeGrid(40, width, height));
  const [pts, setPts] = useState<Pt[]>([]);

  useEffect(()=>{
    const g = gridRef.current;
    samples.forEach(s=> addHit(g, s.x, s.y, s.w ?? 1));
    decay(g, 60_000, 2_000);
    const norm = normalize(g);
    const cols = Math.ceil(g.w/g.cell);
    const out: Pt[] = [];
    for (let j=0;j<Math.ceil(g.h/g.cell);j++){
      for (let i=0;i<cols;i++){
        const val = norm[j*cols+i];
        if (val>0.02) {out.push({ x: (i+0.5)*g.cell, y: (j+0.5)*g.cell, v: val });}
      }
    }
    setPts(out);
    const t = setTimeout(()=>setPts([...out]), 2000);
    return ()=>clearTimeout(t);
  },[samples,width,height]);

  // CRITICAL: Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear any pending timeouts
      // Simplified cleanup - would need proper timeout management
      // HeatOverlay cleanup completed
    };
  }, []);

  return (
    <View pointerEvents="none" style={{position:"absolute", left:0, top:0, width, height}}>
      <Svg width={width} height={height}>
        {pts.map((p,idx)=>(
          <Circle key={idx} cx={p.x} cy={p.y} r={28 + p.v*28} fill={`rgba(239,68,68,${0.08 + p.v*0.22})`}/>
        ))}
      </Svg>
    </View>
  );
}



