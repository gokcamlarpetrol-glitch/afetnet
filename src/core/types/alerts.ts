export type AlertSeverity = 'info' | 'warning' | 'danger';

export interface EmergencyAlert {
  id: string;
  title: string;
  type: string;
  severity: AlertSeverity;
  location: string;
  message: string;
  timestamp: string;
}
