import type { HelpPayload, QueueItem } from "./types";

export const newItem = (payload: HelpPayload): QueueItem => ({
  id: String(Date.now()),
  payload,
  attempts: 0,
  lastError: null,
  nextAt: Date.now(),
});
