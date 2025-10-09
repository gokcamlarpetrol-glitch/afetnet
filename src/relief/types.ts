export type FacilityKind = "shelter"|"clinic"|"pharmacy"|"food"|"water";
export type Facility = {
  id: string;
  kind: FacilityKind;
  name: string;
  lat: number; lng: number;
  capacity?: number;   // persons or daily
  open?: string;       // hours or "24/7"
  note?: string;
  lastTs?: number;     // last verified
};

export type HelpPriority = "life"|"urgent"|"normal";
export type HelpStatus = "new"|"queued"|"assigned"|"enroute"|"done"|"cancelled";
export type HelpTicket = {
  id: string; ts: number;
  kind: "medical"|"rescue"|"evac"|"supply"|"other";
  title: string; detail?: string;
  qlat?: number; qlng?: number;
  prio: HelpPriority;
  status: HelpStatus;
  requester?: { name?:string; roomId?:string };
  assignee?: { callsign?:string; deviceId?:string };
  hops?: number;
};



