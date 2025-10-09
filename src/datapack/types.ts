export type DataPackManifest = {
  v:1;
  packId: string;
  version: string;
  createdTs: number;
  files: { path: string; sha256: string; mode: "add"|"update"|"remove" }[];
  note?: string;
};



