import { Platform } from "react-native";
import createIOS from "./P2P.ios";
import createAndroid from "./P2P.android";
import { notSupported, P2P } from "./P2P";
export let _p2pInst: P2P | null = null;

let inst: P2P | null = null;
export default function getP2P(): P2P {
  if (inst) {return inst;}
  if (Platform.OS === "ios") {inst = createIOS() as any;}
  else if (Platform.OS === "android") {inst = createAndroid() as any;}
  else {inst = notSupported();}
  _p2pInst = inst;
  return inst!;
}
