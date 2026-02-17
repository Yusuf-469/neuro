import { Timestamp } from 'firebase/firestore';

// User Profile
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
  headsetPaired: string | null;
  preferences: UserPreferences;
  therapistHistory: string[];
  currentStreak: number;
  lastSession: Timestamp | null;
}

export interface UserPreferences {
  voiceSpeed: 'slow' | 'normal' | 'fast';
  theme: 'dark' | 'darker';
  hapticEnabled: boolean;
}

// EEG Session
export interface EEGSession {
  id: string;
  userId: string;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  duration: number; // seconds
  deviceId: string;
  
  // Raw data reference (stored in Firebase Storage)
  rawDataUrl: string | null;
  
  // Processed summary
  summary: SessionSummary;
  
  // For AI therapist context
  keyMoments: KeyMoment[];
}

export interface SessionSummary {
  dominantStates: DominantState[];
  averageQuality: number;
  peakCoherence: number;
  totalDataPoints: number;
}

export interface DominantState {
  state: string;
  duration: number;
  percentage: number;
}

export interface KeyMoment {
  timestamp: number;
  band: string;
  note: string;
}

// Therapy Conversation
export interface TherapyConversation {
  id: string;
  userId: string;
  sessionId: string | null;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  messages: TherapyMessage[];
  insights: string[];
}

export interface TherapyMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Timestamp;
  eegContext?: EEGContext;
}

export interface EEGContext {
  dominant: string;
  quality: number;
  coherence?: number;
}

// User Analytics
export interface UserAnalytics {
  userId: string;
  totalSessions: number;
  totalTherapyMinutes: number;
  stateDistribution: Record<string, number>;
  weeklyTrend: WeeklyTrend[];
  improvementAreas: string[];
  lastUpdated: Timestamp;
}

export interface WeeklyTrend {
  week: string;
  dominant: string;
  sessions: number;
  averageQuality: number;
}

// Device Info
export interface PairedDevice {
  id: string;
  name: string;
  type: 'muse' | 'openbci' | 'generic';
  pairedAt: Timestamp;
  lastUsed: Timestamp;
  totalSessions: number;
}
