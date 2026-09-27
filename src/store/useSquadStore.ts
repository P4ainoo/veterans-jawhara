import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'PLAYER' | 'COACH' | 'ADMIN';
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';
export type HealthStatus = 'HEALTHY' | 'INJURED' | 'RECOVERING' | 'AWAY';

export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  phoneNumber: string;
  avatarUrl: string;
  role: UserRole;
  jerseyNumber?: number;
  position?: Position;
  healthStatus?: HealthStatus;
  avgRating?: number;
  matchCount?: number;
  goals?: number;
  assists?: number;
  yellowCards?: number;
  redCards?: number;
  isOnboarded?: boolean;
}

export interface SquadEvent {
  id: string;
  type: 'TRAINING' | 'MATCH' | 'EVENT';
  date: string;
  time: string;
  venue: string;
  opponent?: string;
  formation?: string;
  pitchAssignments?: Record<string, string>; // slotId -> userId
  benchAssignments?: string[]; // userIds
  isCompleted: boolean;
  isPublished: boolean;
  notes?: string;
  coachSummary?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  matchStats?: Record<string, {
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    rating: number;
  }>;
}

interface SquadState {
  currentUser: UserProfile | null;
  roster: UserProfile[];
  events: SquadEvent[];
  activeEventId: string | null;
  
  // Actions
  setCurrentUser: (user: UserProfile | null) => void;
  setRoster: (roster: UserProfile[]) => void;
  setEvents: (events: SquadEvent[]) => void;
  setActiveEvent: (id: string | null) => void;
  
  // Tactical Actions (Coach)
  updateLineup: (eventId: string, lineup: { formation?: string, pitch?: Record<string, string>, bench?: string[] }) => void;
}

export const useSquadStore = create<SquadState>()(
  persist(
    (set) => ({
      currentUser: null,
      roster: [],
      events: [],
      activeEventId: null,

      setCurrentUser: (user) => set({ currentUser: user }),
      setRoster: (roster) => set({ roster }),
      setEvents: (events) => set({ events }),
      setActiveEvent: (id) => set({ activeEventId: id }),

      updateLineup: (eventId, lineup) => set((state) => ({
        events: state.events.map(e => e.id === eventId ? {
          ...e,
          ...lineup,
          pitchAssignments: lineup.pitch || e.pitchAssignments,
          benchAssignments: lineup.bench || e.benchAssignments,
          formation: lineup.formation || e.formation
        } : e)
      })),
    }),
    { name: 'squad7-storage' }
  )
);
