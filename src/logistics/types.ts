export type LCategory = "shelter"|"water"|"food"|"medicine"|"equipment";
export type LMode = "request"|"offer";
export type LItem = {
  id: string;
  ts: number;
  cat: LCategory;
  mode: LMode;
  text: string;       // 180 char
  ttlSec: number;     // default 24h
  qlat?: number; qlng?: number;
};



