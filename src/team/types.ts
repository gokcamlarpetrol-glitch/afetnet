export type TeamMember = { didShort: string; name?: string };
export type Team = {
  teamId: string;
  name: string;
  members: TeamMember[];
  quorum: { m: number; n: number };
  ts: number;
};

export type ApprovalType = 'role_badge' | 'task_grant' | 'zone_access';
export type Approval = {
  id: string;
  teamId: string;
  type: ApprovalType;
  payload: any; // free-form (e.g., { role:"coordinator" } or { taskId:"..." } or { zoneId:"..." })
  signers: string[];  // didShort list
  status: 'pending'|'approved'|'rejected';
  createdTs: number;
  ttlSec: number;     // default 24h
};