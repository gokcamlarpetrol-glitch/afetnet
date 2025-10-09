export type EvidenceItem = 
  | { t: "photo"; path: string; w?: number; h?: number; ts: number }
  | { t: "audio"; path: string; dur?: number; ts: number }
  | { t: "note";  text: string; ts: number };

export type EvidencePack = {
  id: string;                  // pack id (ulid-like)
  ts: number;                  // creation time
  items: EvidenceItem[];
  qlat?: number; qlng?: number;
  sha256?: string;             // hash of manifest (set on finalize)
};

export type EvidenceNotice = {
  v: 1;
  kind: "evidence_notice";
  id: string;                  // pack id
  ts: number;
  qlat?: number; qlng?: number;
  count: number;               // item count
};



