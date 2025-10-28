// src/relief/types.ts
export interface ReliefPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'shelter' | 'medical' | 'food' | 'water' | 'evacuation';
  capacity?: number;
  occupied?: number;
  status: 'active' | 'inactive' | 'full';
  contact?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReliefRequest {
  id: string;
  pointId: string;
  requesterId: string;
  type: 'medical' | 'food' | 'water' | 'shelter' | 'transport';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface ReliefResource {
  id: string;
  pointId: string;
  type: 'medical' | 'food' | 'water' | 'shelter' | 'transport';
  name: string;
  quantity: number;
  unit: string;
  available: boolean;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReliefVolunteer {
  id: string;
  name: string;
  phone: string;
  skills: string[];
  location: {
    lat: number;
    lng: number;
  };
  status: 'available' | 'busy' | 'offline';
  lastSeen: string;
}

export interface ReliefTeam {
  id: string;
  name: string;
  leaderId: string;
  members: string[];
  location: {
    lat: number;
    lng: number;
  };
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface ReliefStats {
  totalPoints: number;
  activePoints: number;
  totalRequests: number;
  pendingRequests: number;
  completedRequests: number;
  totalVolunteers: number;
  activeVolunteers: number;
  totalResources: number;
  availableResources: number;
}

// Additional types for other modules
export interface Facility {
  id: string;
  name: string;
  type: string;
  kind?: string;
  location: {
    lat: number;
    lng: number;
  };
  status: 'active' | 'inactive';
  capacity?: number;
  occupied?: number;
  note?: string;
  open?: boolean;
}

export type FacilityKind = 'shelter' | 'medical' | 'food' | 'water' | 'evacuation' | 'transport' | 'communication';

export interface HelpTicket {
  id: string;
  requesterId: string;
  title: string;
  description: string;
  detail?: string;
  kind?: string;
  prio?: 'low' | 'medium' | 'high' | 'critical' | 'urgent' | 'life' | 'normal';
  priority: 'low' | 'medium' | 'high' | 'critical' | 'normal';
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'new' | 'cancelled' | 'enroute' | 'done' | 'queued' | 'assigned';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  ts?: number;
  qlat?: number;
  qlng?: number;
}
