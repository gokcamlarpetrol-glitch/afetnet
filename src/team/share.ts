import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { listTeams } from './store';

export async function exportTasks(){
  const data = await listTeams();
  const path = '/tmp/' + `tasks_${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data,null,2), { encoding: 'utf8' });
  if (await Sharing.isAvailableAsync()) {await Sharing.shareAsync(path,{ mimeType:'application/json', dialogTitle:'Görevler' });}
  return path;
}

export async function importTasksFrom(uri: string){
  const json = await FileSystem.readAsStringAsync(uri);
  return JSON.parse(json);
}
