import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "afn:ice:v1";
export type ICE = {
  name: string;
  blood?: string;
  allergies?: string;
  meds?: string;
  contacts?: { name: string; phone: string }[];
};

export async function saveICE(data: ICE) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}
export async function loadICE(): Promise<ICE | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}



