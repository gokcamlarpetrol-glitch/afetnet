export type UUID = string;
export type Iso = string;

export type InvItem = {
  id: UUID;
  name: string;
  kind: "medical"|"tool"|"food"|"water"|"comm"|"other";
  qty: number;
  unit?: string;
  note?: string;
  tagId?: string;     // equipment QR/NFC tag
  updated: number;    // ts
};

export type TeamMember = {
  id: UUID;
  name: string;
  callsign?: string;
  role?: "medic"|"search"|"coord"|"driver"|"log"|"vol";
  reachable?: boolean;
};

export type Team = {
  id: UUID;
  label: string;
  members: TeamMember[];
  updated: number;
};

export type TaskStatus = "new"|"assigned"|"enroute"|"onsite"|"complete"|"cancelled";
export type Task = {
  id: UUID;
  title: string;
  detail?: string;
  prio: "life"|"urgent"|"normal";
  assignees: UUID[];        // team member ids
  waypoints?: { lat:number; lng:number; label?:string }[];
  status: TaskStatus;
  created: number;
  updated: number;
};

export type ConvoyPing = {
  id: UUID;     // member or team id
  ts: number;
  lat?: number; lng?: number;
  speedKph?: number;
  note?: string;
};

export type Bulletin = {
  id: UUID;
  title: string;
  body: string;
  cat: "shelter"|"health"|"safety"|"logistics"|"general";
  prio: "high"|"med"|"low";
  expires?: number;
  ts: number;
  sig?: string;  // optional signature hash (light)
};

export function makeId(prefix="id"){ return prefix+"_"+Math.random().toString(36).slice(2,10); }



