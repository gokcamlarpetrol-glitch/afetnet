export type CapSeverity = 'Extreme'|'Severe'|'Moderate'|'Minor'|'Unknown';
export type CapCategory = 'Rescue'|'Fire'|'Medical'|'Weather'|'Infrastructure'|'Other';

export type CapLite = {
  identifier: string;      // unique id
  sender: string;          // device id or team
  sent: string;            // ISO
  status: 'Actual'|'Exercise'|'System'|'Test'|'Draft';
  msgType: 'Alert'|'Update'|'Cancel';
  scope: 'Public'|'Restricted'|'Private';
  info: {
    category: CapCategory[];
    event: string;         // summary
    urgency: 'Immediate'|'Expected'|'Future'|'Past'|'Unknown';
    severity: CapSeverity;
    certainty: 'Observed'|'Likely'|'Possible'|'Unlikely'|'Unknown';
    headline?: string;
    description?: string;
    contact?: string;
    area?: { lat:number; lon:number; radiusM?: number };
  };
};

export function validate(cap: CapLite){ 
  if (!cap.identifier || !cap.sender || !cap.sent) {return false;}
  if (!cap.info?.event || !cap.info?.category?.length) {return false;}
  return true;
}



