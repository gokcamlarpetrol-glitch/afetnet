import { SafeMBTiles } from "./SafeMBTiles";
import * as FileSystem from "expo-file-system";

type ServerHandle = { close: ()=>void };
const db: any = null;
const fmt: "png"|"jpg"|"pbf" = "png";
const server: any = null;

function httpResp(status:number, headers:Record<string,string>, body:Uint8Array|string){
  const h = Object.entries(headers).map(([k,v])=>`${k}: ${v}`).join("\r\n");
  const head = `HTTP/1.1 ${status} OK\r\n${h}\r\n\r\n`;
  if (typeof body === "string") {return Buffer.concat([Buffer.from(head,"utf8"), Buffer.from(body,"utf8")]);}
  return Buffer.concat([Buffer.from(head,"utf8"), Buffer.from(body)]);
}

export async function openDbFromUri(uri: string){
  return SafeMBTiles.openDbFromUri(uri);
}

async function readTile(z:number, x:number, y:number): Promise<Uint8Array|null>{
  return SafeMBTiles.readTile(z, x, y);
}

function parsePath(line:string){
  return SafeMBTiles.parsePath(line);
}

export async function startMbtilesServer(): Promise<ServerHandle> {
  return SafeMBTiles.startMbtilesServer();
}

export async function stopMbtilesServer(){ return SafeMBTiles.stopMbtilesServer(); }

export function localTileUrlTemplate(){
  return SafeMBTiles.localTileUrlTemplate();
}

export function currentFormat(){ return SafeMBTiles.currentFormat(); }
