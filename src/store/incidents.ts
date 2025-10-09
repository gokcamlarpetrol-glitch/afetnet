import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface Incident {
  id: string;
  mag?: number;
  place?: string;
  lat?: number;
  lon?: number;
  firstTs: number;
  lastTs: number;
  confirmations: {
    sound: number;
    listen: number;
    arrived: number;
  };
  priority: number;
  assignedTo?: string;
  status: 'open' | 'enroute' | 'arrived' | 'resolved';
  helpers: string[]; // Device IDs of helpers who responded
}

interface IncidentsState {
  incidents: Map<string, Incident>;
}

interface IncidentsActions {
  addIncident: (incident: Omit<Incident, 'confirmations' | 'priority' | 'helpers' | 'status'>) => void;
  updateIncident: (id: string, updates: Partial<Incident>) => void;
  upsertFromSOS: (sosMsg: any) => void;
  mark: (id: string, field: 'sound' | 'listen' | 'arrived', helperId: string) => void;
  assignTo: (id: string, meId: string) => void;
  addConfirmation: (id: string, type: 'sound' | 'listen' | 'arrived', helperId: string) => void;
  removeIncident: (id: string) => void;
  getIncident: (id: string) => Incident | undefined;
  getAllIncidents: () => Incident[];
  getSortedIncidents: () => Incident[];
  computePriority: (incident: Incident) => number;
  clearAll: () => void;
}

const defaultState: IncidentsState = {
  incidents: new Map()
};

function calculatePriorityScore(incident: Incident): number {
  const now = Date.now();
  const ageMinutes = (now - incident.firstTs) / (1000 * 60);
  const timeSinceLastUpdate = (now - incident.lastTs) / (1000 * 60);
  
  // Base score from confirmations
  const confirmationScore = 
    incident.confirmations.sound * 0.3 +
    incident.confirmations.listen * 0.5 +
    incident.confirmations.arrived * 0.8;
  
  // Time-based scoring
  let timeScore = 1.0;
  
  // Recent incidents get higher priority
  if (ageMinutes < 30) {
    timeScore = 1.5;
  } else if (ageMinutes < 60) {
    timeScore = 1.2;
  } else if (ageMinutes < 120) {
    timeScore = 1.0;
  } else {
    timeScore = 0.8;
  }
  
  // Stale incidents get lower priority
  if (timeSinceLastUpdate > 60) {
    timeScore *= 0.7;
  }
  
  // Helper count bonus
  const helperBonus = Math.min(incident.helpers.length * 0.1, 0.5);
  
  const finalScore = (confirmationScore + helperBonus) * timeScore;
  
  return Math.max(0, Math.min(10, finalScore));
}

export const useIncidents = create<IncidentsState & IncidentsActions>()(
  persist(
    (set, get) => ({
      ...defaultState,

      addIncident: (incidentData) => {
        const incident: Incident = {
          ...incidentData,
          confirmations: { sound: 0, listen: 0, arrived: 0 },
          priority: 1.0,
          helpers: [],
          status: 'open'
        };
        
        incident.priority = calculatePriorityScore(incident);
        
        set((state) => {
          const newIncidents = new Map(state.incidents);
          newIncidents.set(incident.id, incident);
          return { incidents: newIncidents };
        });
      },

      upsertFromSOS: (sosMsg) => {
        const existing = get().incidents.get(sosMsg.id);
        
        if (existing) {
          // Update existing incident
          const updated = {
            ...existing,
            lastTs: Date.now(),
            lat: sosMsg.lat || existing.lat,
            lon: sosMsg.lon || existing.lon,
          };
          updated.priority = calculatePriorityScore(updated);
          
          set((state) => {
            const newIncidents = new Map(state.incidents);
            newIncidents.set(sosMsg.id, updated);
            return { incidents: newIncidents };
          });
        } else {
          // Create new incident
          get().addIncident({
            id: sosMsg.id,
            lat: sosMsg.lat,
            lon: sosMsg.lon,
            firstTs: Date.now(),
            lastTs: Date.now(),
          });
        }
      },

      mark: (id, field, helperId) => {
        set((state) => {
          const incident = state.incidents.get(id);
          if (!incident) return state;
          
          const updatedIncident = {
            ...incident,
            confirmations: {
              ...incident.confirmations,
              [field]: incident.confirmations[field] + 1
            },
            helpers: incident.helpers.includes(helperId) 
              ? incident.helpers 
              : [...incident.helpers, helperId],
            lastTs: Date.now()
          };
          
          updatedIncident.priority = calculatePriorityScore(updatedIncident);
          
          const newIncidents = new Map(state.incidents);
          newIncidents.set(id, updatedIncident);
          return { incidents: newIncidents };
        });
      },

      assignTo: (id, meId) => {
        set((state) => {
          const incident = state.incidents.get(id);
          if (!incident) return state;
          
          const updatedIncident = {
            ...incident,
            assignedTo: meId,
            status: 'enroute' as const,
            lastTs: Date.now()
          };
          
          updatedIncident.priority = calculatePriorityScore(updatedIncident);
          
          const newIncidents = new Map(state.incidents);
          newIncidents.set(id, updatedIncident);
          return { incidents: newIncidents };
        });
      },

      updateIncident: (id, updates) => {
        set((state) => {
          const incident = state.incidents.get(id);
          if (!incident) return state;
          
          const updatedIncident = {
            ...incident,
            ...updates,
            lastTs: Date.now()
          };
          
          updatedIncident.priority = calculatePriorityScore(updatedIncident);
          
          const newIncidents = new Map(state.incidents);
          newIncidents.set(id, updatedIncident);
          return { incidents: newIncidents };
        });
      },

      addConfirmation: (id, type, helperId) => {
        set((state) => {
          const incident = state.incidents.get(id);
          if (!incident) return state;
          
          // Check if helper already confirmed this type
          const hasConfirmed = incident.helpers.includes(helperId);
          
          const updatedIncident = {
            ...incident,
            confirmations: {
              ...incident.confirmations,
              [type]: hasConfirmed ? incident.confirmations[type] : incident.confirmations[type] + 1
            },
            helpers: hasConfirmed ? incident.helpers : [...incident.helpers, helperId],
            lastTs: Date.now()
          };
          
          updatedIncident.priority = calculatePriorityScore(updatedIncident);
          
          const newIncidents = new Map(state.incidents);
          newIncidents.set(id, updatedIncident);
          return { incidents: newIncidents };
        });
      },

      computePriority: (incident) => {
        return calculatePriorityScore(incident);
      },

      removeIncident: (id) => {
        set((state) => {
          const newIncidents = new Map(state.incidents);
          newIncidents.delete(id);
          return { incidents: newIncidents };
        });
      },

      getIncident: (id) => {
        return get().incidents.get(id);
      },

      getAllIncidents: () => {
        return Array.from(get().incidents.values());
      },

      getSortedIncidents: () => {
        const incidents = Array.from(get().incidents.values());
        return incidents.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      },

      clearAll: () => {
        set({ incidents: new Map() });
      }
    }),
    {
      name: 'afn/incidents/v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Convert array to Map if needed
        if (Array.isArray(persistedState.incidents)) {
          const incidentsMap = new Map();
          persistedState.incidents.forEach((incident: Incident) => {
            incidentsMap.set(incident.id, incident);
          });
          persistedState.incidents = incidentsMap;
        }
        return { ...defaultState, ...persistedState };
      },
    } as any
  )
);
