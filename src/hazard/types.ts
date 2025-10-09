export type HazardType = "aftershock"|"collapse"|"gas"|"flood"|"other";
export type HazardZone = {
  id: string;
  t: HazardType;
  severity: 1|2|3;
  // simple circle zone (center+radius meters); polygon optional later
  center: { lat:number; lng:number };
  radius: number; // meters
  ts: number;
  note?: string;
};



