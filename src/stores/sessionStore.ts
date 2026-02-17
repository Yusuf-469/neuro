import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { EEGSession, SessionSummary, KeyMoment } from '../types/firebase';
import { collection, addDoc, updateDoc, doc, query, where, orderBy, limit, getDocs, getDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, COLLECTIONS, STORAGE_PATHS } from '../lib/firebase';
import { useEEGStore } from './eegStore';

interface SessionState {
  // Current session
  currentSession: EEGSession | null;
  isRecording: boolean;
  sessionStartTime: number | null;
  
  // Session history
  sessions: EEGSession[];
  isLoadingSessions: boolean;
  
  // Selected session for viewing
  selectedSession: EEGSession | null;
  
  // Actions
  startSession: (deviceId: string) => Promise<string>;
  endSession: () => Promise<void>;
  addKeyMoment: (moment: KeyMoment) => void;
  loadSessions: (userId: string) => Promise<void>;
  selectSession: (session: EEGSession | null) => void;
  getSessionById: (sessionId: string) => Promise<EEGSession | null>;
  exportSessionData: (sessionId: string) => Promise<Blob>;
}

export const useSessionStore = create<SessionState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentSession: null,
    isRecording: false,
    sessionStartTime: null,
    sessions: [],
    isLoadingSessions: false,
    selectedSession: null,
    
    // Start a new session
    startSession: async (deviceId: string) => {
      const userId = 'anonymous'; // Get from user store in real implementation
      
      const newSession: Omit<EEGSession, 'id'> = {
        userId,
        startedAt: Timestamp.now(),
        endedAt: null,
        duration: 0,
        deviceId,
        rawDataUrl: null,
        summary: {
          dominantStates: [],
          averageQuality: 0,
          peakCoherence: 0,
          totalDataPoints: 0,
        },
        keyMoments: [],
      };
      
      const docRef = await addDoc(collection(db, COLLECTIONS.SESSIONS), newSession);
      
      const session: EEGSession = {
        ...newSession,
        id: docRef.id,
      };
      
      set({ 
        currentSession: session, 
        isRecording: true,
        sessionStartTime: Date.now()
      });
      
      return docRef.id;
    },
    
    // End current session
    endSession: async () => {
      const { currentSession, sessionStartTime } = get();
      const eegStore = useEEGStore.getState();
      
      if (!currentSession || !sessionStartTime) return;
      
      const endTime = Date.now();
      const duration = Math.floor((endTime - sessionStartTime) / 1000);
      
      // Calculate summary from buffer
      const buffer = eegStore.buffer;
      const summary = calculateSessionSummary(buffer, duration);
      
      // Upload raw data to storage
      let rawDataUrl: string | null = null;
      if (eegStore.rawBuffer.length > 0) {
        try {
          const csvData = convertToCSV(eegStore.rawBuffer);
          const blob = new Blob([csvData], { type: 'text/csv' });
          const storageRef = ref(storage, STORAGE_PATHS.sessionRaw(currentSession.userId, currentSession.id));
          await uploadBytes(storageRef, blob);
          rawDataUrl = await getDownloadURL(storageRef);
        } catch (error) {
          console.error('Failed to upload raw data:', error);
        }
      }
      
      // Update session in Firestore
      await updateDoc(doc(db, COLLECTIONS.SESSIONS, currentSession.id), {
        endedAt: Timestamp.now(),
        duration,
        summary,
        rawDataUrl,
      });
      
      const updatedSession: EEGSession = {
        ...currentSession,
        endedAt: Timestamp.now(),
        duration,
        summary,
        rawDataUrl,
      };
      
      set((state) => ({
        currentSession: null,
        isRecording: false,
        sessionStartTime: null,
        sessions: [updatedSession, ...state.sessions],
      }));
    },
    
    // Add a key moment during session
    addKeyMoment: (moment) => {
      const { currentSession } = get();
      if (!currentSession) return;
      
      const updatedMoments = [...currentSession.keyMoments, moment];
      
      set({
        currentSession: {
          ...currentSession,
          keyMoments: updatedMoments,
        },
      });
    },
    
    // Load sessions for a user
    loadSessions: async (userId: string) => {
      set({ isLoadingSessions: true });
      
      try {
        const q = query(
          collection(db, COLLECTIONS.SESSIONS),
          where('userId', '==', userId),
          orderBy('startedAt', 'desc'),
          limit(50)
        );
        
        const querySnapshot = await getDocs(q);
        const sessions: EEGSession[] = [];
        
        querySnapshot.forEach((doc) => {
          sessions.push({ id: doc.id, ...doc.data() } as EEGSession);
        });
        
        set({ sessions, isLoadingSessions: false });
      } catch (error) {
        console.error('Failed to load sessions:', error);
        set({ isLoadingSessions: false });
      }
    },
    
    // Select a session for viewing
    selectSession: (session) => set({ selectedSession: session }),
    
    // Get a specific session by ID
    getSessionById: async (sessionId: string) => {
      try {
        const docRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as EEGSession;
        }
        return null;
      } catch (error) {
        console.error('Failed to get session:', error);
        return null;
      }
    },
    
    // Export session data as downloadable blob
    exportSessionData: async (sessionId: string) => {
      const session = await get().getSessionById(sessionId);
      if (!session?.rawDataUrl) {
        throw new Error('No raw data available for this session');
      }
      
      const response = await fetch(session.rawDataUrl);
      return response.blob();
    },
  }))
);

// Helper functions
function calculateSessionSummary(buffer: any[], duration: number): SessionSummary {
  if (buffer.length === 0) {
    return {
      dominantStates: [],
      averageQuality: 0,
      peakCoherence: 0,
      totalDataPoints: 0,
    };
  }
  
  // Count dominant states
  const stateCounts: Record<string, number> = {};
  let totalQuality = 0;
  let peakCoherence = 0;
  
  buffer.forEach((data) => {
    stateCounts[data.dominant] = (stateCounts[data.dominant] || 0) + 1;
    totalQuality += data.quality;
    peakCoherence = Math.max(peakCoherence, data.coherence);
  });
  
  const dominantStates = Object.entries(stateCounts).map(([state, count]) => ({
    state,
    duration: Math.floor((count / buffer.length) * duration),
    percentage: Math.round((count / buffer.length) * 100),
  }));
  
  return {
    dominantStates,
    averageQuality: Math.round(totalQuality / buffer.length),
    peakCoherence: Math.round(peakCoherence * 100) / 100,
    totalDataPoints: buffer.length,
  };
}

function convertToCSV(buffer: any[]): string {
  const header = 'timestamp,tp9,af7,af8,tp10\n';
  const rows = buffer.map((data) => 
    `${data.timestamp},${data.channels.tp9},${data.channels.af7},${data.channels.af8},${data.channels.tp10}`
  );
  return header + rows.join('\n');
}

// Selectors
export const selectCurrentSession = (state: SessionState) => state.currentSession;
export const selectIsRecording = (state: SessionState) => state.isRecording;
export const selectSessions = (state: SessionState) => state.sessions;
