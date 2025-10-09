/** Minimal EDXL-like envelope for bundling messages */
export type Envelope = {
  bundleId: string;
  created: string;
  items: { type: "cap-lite"; payload: any }[];
};
export function wrapCap(cap:any): Envelope{
  return { bundleId: "afn-"+Date.now(), created: new Date().toISOString(), items: [{ type:"cap-lite", payload: cap }] };
}



