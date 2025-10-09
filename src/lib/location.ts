import * as Location from 'expo-location';

export type Coords = { lat: number|null; lon: number|null };

export async function getCoords(): Promise<Coords> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {return { lat: null, lon: null };}
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: loc.coords.latitude, lon: loc.coords.longitude };
  } catch {
    return { lat: null, lon: null };
  }
}

export async function getCurrentPositionSafe() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {return null;}
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, ts: Date.now() };
  } catch { return null; }
}
