import * as FileSystem from 'expo-file-system';
import { FamilyContact } from './types';

const DIR = FileSystem.documentDirectory + 'afetnet/';
const FILE = DIR + 'family.json';

let mem: FamilyContact[] = [];

async function ensureDir() {
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

export async function loadFamily() {
  await ensureDir();
  try {
    const content = await FileSystem.readAsStringAsync(FILE);
    mem = JSON.parse(content);
  } catch {
    mem = [];
  }
  return mem;
}

export async function saveFamily(arr: FamilyContact[]) {
  await ensureDir();
  mem = arr;
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(arr));
}

export async function upsert(c: Partial<FamilyContact> & { name: string }) {
  const arr = mem.length ? mem : await loadFamily();
  const id = c.id || ('fam_' + Math.random().toString(36).slice(2, 8));
  const i = arr.findIndex(x => x.id === id);
  const item = { id, relation: 'diğer', secret: c.secret || Math.random().toString().slice(2, 8), ...c } as FamilyContact;
  if (i >= 0) {
    arr[i] = item;
  } else {
    arr.push(item);
  }
  await saveFamily(arr);
  return item;
}

export async function remove(id: string) {
  const arr = await loadFamily();
  const newArr = arr.filter(x => x.id !== id);
  await saveFamily(newArr);
}

export async function touchSeen(id: string, q?: { lat: number; lng: number }) {
  const arr = await loadFamily();
  const i = arr.findIndex(x => x.id === id);
  if (i >= 0) {
    arr[i].lastSeen = Date.now();
    if (q) {
      arr[i].qlat = q.lat;
      arr[i].qlng = q.lng;
    }
    await saveFamily(arr);
  }
}