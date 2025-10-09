export type PackKind = "tilepack"|"mbtiles"|"datapack";
export type PackManifest = {
  name: string; kind: PackKind; size: number; sha256: string;
  chunkSize: number; chunks: number;
};
export type PackOffer = { id:string; man: PackManifest; ts:number };



