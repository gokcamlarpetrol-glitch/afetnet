import React from 'react';
import { Text, View } from 'react-native';
type S = { hasError:boolean; err?:string };
export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, S>{
  constructor(p:any){ super(p); this.state={ hasError:false }; }
  static getDerivedStateFromError(e:any){ return { hasError:true, err:String(e) }; }
  componentDidCatch(e:any, info:any){ /* no-op: runtime only */ }
  render(){ if(this.state.hasError){ return <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#0f172a', padding:12 }}><Text style={{ color:'#fff', fontWeight:'800' }}>Beklenmeyen Hata</Text><Text style={{ color:'#94a3b8' }}>{this.state.err}</Text></View>; }
    return this.props.children as any; }
}