export type AuditEvent = {
  ts: number;
  actor: 'system'|'user';
  action: string;           // "audio.detect", "mesh.broadcast", "settings.change"
  detail?: Record<string, any>;
};
export type SafetyReport = {
  time: number;
  checks: { key:string; ok:boolean; note?:string }[];
};



