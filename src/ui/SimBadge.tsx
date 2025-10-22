import { StyleSheet, Text, View } from 'react-native';

export default function SimBadge() {
  if (!__DEV__ || !(globalThis as any).process?.env?.EXPO_PUBLIC_DEV_SIM) {return null;}
  return (
    <View style={styles.tip} pointerEvents="none"><Text style={styles.t}>Sim Mode Active</Text></View>
  );
}
const styles = StyleSheet.create({
  tip:{ position:'absolute', right:10, bottom:10, backgroundColor:'#0d3b2e', borderRadius:10, paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:'#164c3d' },
  t:{ color:'#a8f2d1', fontSize:12, fontWeight:'700' },
});



