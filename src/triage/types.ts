export type Triage = {
  id: string;
  ts: number;
  cat: 'RED'|'YELLOW'|'GREEN'|'BLACK';
  pulse?: number;
  resp?: number;
  conscious?: boolean;
  note?: string;
  qlat?: number; qlng?: number;
};



