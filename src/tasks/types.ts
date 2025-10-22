export type TaskStatus = 'open'|'assigned'|'in_progress'|'done'|'cancelled';
export type Task = {
  id: string;
  rev: number;         // optimistic lock
  ts: number;
  itemId: string;      // logistics item id
  assignee?: string;   // short device id
  status: TaskStatus;
  note?: string;
};



