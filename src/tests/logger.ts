import * as FileSystem from "expo-file-system";
const PATH = "/tmp/logs/";
export async function log(name:string, lines:string[]){
  await FileSystem.makeDirectoryAsync(PATH, { intermediates: true }).catch(()=>{});
  const p = PATH + `${name}_${Date.now()}.txt`;
  await FileSystem.writeAsStringAsync(p, lines.join("\n"), { encoding: "utf8" });
  return p;
}



