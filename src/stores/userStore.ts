import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import type { UserProfile, UserPreferences, UserAnalytics } from '../types/firebase';
import { onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, COLLECTIONS } from '../lib/firebase';

interface UserState {
  // Auth state
  user: User | null;
  profile: UserProfile | null;
  analytics: UserAnalytics | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  
  // Preferences (persisted locally)
  preferences: UserPreferences;
  
  // Actions
  initialize: () => () => void;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  setAnalytics: (analytics: UserAnalytics) => void;
  refreshProfile: () => Promise<void>;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  voiceSpeed: 'normal',
  theme: 'dark',
  hapticEnabled: true,
};

export const useUserStore = create<UserState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        profile: null,
        analytics: null,
        isLoading: true,
        isInitialized: false,
        error: null,
        preferences: DEFAULT_PREFERENCES,
        
        // Initialize auth listener
        initialize: () => {
          const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
              set({ user, isLoading: true });
              await get().refreshProfile();
            } else {
              set({ 
                user: null, 
                profile: null, 
                analytics: null,
                isLoading: false,
                isInitialized: true 
              });
            }
          });
          
          return unsubscribe;
        },
        
        // Sign in anonymously
        signIn: async () => {
          try {
            set({ isLoading: true, error: null });
            const result = await signInAnonymously(auth);
            const user = result.user;
            
            // Create initial profile
            const newProfile: UserProfile = {
              uid: user.uid,
              email: '',
              displayName: 'Neuro User',
              createdAt: new Date() as any,
              headsetPaired: null,
              preferences: get().preferences,
              therapistHistory: [],
              currentStreak: 0,
              lastSession: null,
            };
            
            await setDoc(doc(db, COLLECTIONS.USERS, user.uid), newProfile);
            set({ user, profile: newProfile, isLoading: false, isInitialized: true });
          } catch (error: any) {
            set({ error: error.message, isLoading: false });
            throw error;
          }
        },
        
        // Sign out
        signOutUser: async () => {
          try {
            await signOut(auth);
            set({ 
              user: null, 
              profile: null, 
              analytics: null,
              isInitialized: true 
            });
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          }
        },
        
        // Update profile in Firestore
        updateProfile: async (updates) => {
          const { user, profile } = get();
          if (!user || !profile) return;
          
          try {
            await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), updates);
            set({ profile: { ...profile, ...updates } });
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          }
        },
        
        // Update local preferences
        updatePreferences: (prefs) => {
          set((state) => ({
            preferences: { ...state.preferences, ...prefs },
          }));
        },
        
        // Set analytics
        setAnalytics: (analytics) => set({ analytics }),
        
        // Refresh profile from Firestore
        refreshProfile: async () => {
          const { user } = get();
          if (!user) return;
          
          try {
            const docRef = doc(db, COLLECTIONS.USERS, user.uid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
              set({ 
                profile: docSnap.data() as UserProfile,
                isLoading: false,
                isInitialized: true 
              });
            } else {
              // Profile doesn't exist, create it
              const newProfile: UserProfile = {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'Neuro User',
                createdAt: new Date() as any,
                headsetPaired: null,
                preferences: get().preferences,
                therapistHistory: [],
                currentStreak: 0,
                lastSession: null,
              };
              
              await setDoc(docRef, newProfile);
              set({ profile: newProfile, isLoading: false, isInitialized: true });
            }
          } catch (error: any) {
            set({ error: error.message, isLoading: false, isInitialized: true });
          }
        },
      }),
      {
        name: 'neuro-user-preferences',
        partialize: (state) => ({ preferences: state.preferences }),
      }
    )
  )
);

// Selectors
export const selectUser = (state: UserState) => state.user;
export const selectProfile = (state: UserState) => state.profile;
export const selectPreferences = (state: UserState) => state.preferences;
export const selectIsLoading = (state: UserState) => state.isLoading;
