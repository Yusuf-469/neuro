import { create } from 'zustand';
import { askTherapist } from '../lib/therapistApi';
import { subscribeWithSelector } from 'zustand/middleware';
import type { TherapyConversation, TherapyMessage, EEGContext } from '../types/firebase';
import { collection, addDoc, updateDoc, doc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db, COLLECTIONS } from '../lib/firebase';
import { useEEGStore } from './eegStore';

interface TherapistState {
  // Current conversation
  currentConversation: TherapyConversation | null;
  messages: TherapyMessage[];
  isTyping: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  
  // Conversation history
  conversations: TherapyConversation[];
  
  // AI state
  systemPrompt: string;
  temperature: number;
  
  // Actions
  startConversation: (sessionId?: string) => Promise<string>;
  endConversation: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  addMessage: (message: Omit<TherapyMessage, 'id' | 'timestamp'>) => void;
  setTyping: (typing: boolean) => void;
  setListening: (listening: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  loadConversations: (userId: string) => Promise<void>;
  getAIResponse: (userMessage: string) => Promise<string>;
}

const SYSTEM_PROMPT = `You are a compassionate AI therapist integrated with a real-time EEG brain monitoring system. Your role is to:

1. Provide supportive, empathetic conversation
2. Use EEG data to understand the user's mental state
3. Adapt your responses based on brain wave patterns
4. Guide meditation and mindfulness exercises
5. Help users understand their mental patterns

EEG State Meanings:
- Delta (0.5-4 Hz): Deep sleep, unconscious processing
- Theta (4-8 Hz): Meditation, creativity, emotional processing
- Alpha (8-13 Hz): Relaxation, calm focus, flow state
- Beta (13-30 Hz): Active thinking, potential anxiety
- Gamma (30-100 Hz): Peak cognition, insight, transcendence

Always be supportive, non-judgmental, and adaptive to the user's current brain state.`;

export const useTherapistStore = create<TherapistState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentConversation: null,
    messages: [],
    isTyping: false,
    isListening: false,
    isSpeaking: false,
    conversations: [],
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.7,
    
    // Start a new conversation
    startConversation: async (sessionId?: string) => {
      const userId = 'anonymous'; // Get from user store in real implementation
      
      const newConversation: Omit<TherapyConversation, 'id'> = {
        userId,
        sessionId: sessionId || null,
        startedAt: Timestamp.now(),
        endedAt: null,
        messages: [],
        insights: [],
      };
      
      const docRef = await addDoc(collection(db, COLLECTIONS.CONVERSATIONS), newConversation);
      
      const conversation: TherapyConversation = {
        ...newConversation,
        id: docRef.id,
      };
      
      set({ 
        currentConversation: conversation, 
        messages: [] 
      });
      
      return docRef.id;
    },
    
    // End current conversation
    endConversation: async () => {
      const { currentConversation, messages } = get();
      if (!currentConversation) return;
      
      // Generate insights from conversation
      const insights = generateInsights(messages);
      
      await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversation.id), {
        endedAt: Timestamp.now(),
        messages,
        insights,
      });
      
      set((state) => ({
        currentConversation: null,
        messages: [],
        conversations: [
          { ...currentConversation, messages, insights, endedAt: Timestamp.now() },
          ...state.conversations,
        ],
      }));
    },
    
    // Send a message and get AI response
    sendMessage: async (content: string) => {
      const { currentConversation, messages } = get();
      if (!currentConversation) return;
      
      // Get current EEG context
      const eegStore = useEEGStore.getState();
      const eegContext: EEGContext | undefined = eegStore.currentData ? {
        dominant: eegStore.currentData.dominant,
        quality: eegStore.currentData.quality,
        coherence: eegStore.currentData.coherence,
      } : undefined;
      
      // Add user message
      const userMessage: TherapyMessage = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Timestamp.now(),
        eegContext,
      };
      
      set((state) => ({ messages: [...state.messages, userMessage] }));
      
      // Get AI response
      set({ isTyping: true });
      
      try {
        const aiResponse = await get().getAIResponse(content);
        
        const assistantMessage: TherapyMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiResponse,
          timestamp: Timestamp.now(),
          eegContext,
        };
        
        set((state) => ({ 
          messages: [...state.messages, assistantMessage],
          isTyping: false 
        }));
        
        // Update conversation in Firestore
        const updatedMessages = [...messages, userMessage, assistantMessage];
        await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversation.id), {
          messages: updatedMessages,
        });
      } catch (error) {
        console.error('Failed to get AI response:', error);
        set({ isTyping: false });
      }
    },
    
    // Add a message manually
    addMessage: (message) => {
      const fullMessage: TherapyMessage = {
        ...message,
        id: Date.now().toString(),
        timestamp: Timestamp.now(),
      };
      
      set((state) => ({ messages: [...state.messages, fullMessage] }));
    },
    
    // Set typing state
    setTyping: (isTyping) => set({ isTyping }),
    
    // Set listening state
    setListening: (isListening) => set({ isListening }),
    
    // Set speaking state
    setSpeaking: (isSpeaking) => set({ isSpeaking }),
    
    // Load conversations for a user
    loadConversations: async (userId: string) => {
      try {
        const q = query(
          collection(db, COLLECTIONS.CONVERSATIONS),
          where('userId', '==', userId),
          orderBy('startedAt', 'desc'),
          limit(20)
        );
        
        const querySnapshot = await getDocs(q);
        const conversations: TherapyConversation[] = [];
        
        querySnapshot.forEach((doc) => {
          conversations.push({ id: doc.id, ...doc.data() } as TherapyConversation);
        });
        
        set({ conversations });
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    },
    
    // Get AI response from the /api/therapist serverless function (the key stays server-side)
    getAIResponse: async (userMessage: string) => {
      const { messages } = get();
      const eegStore = useEEGStore.getState();
      const reply = await askTherapist(
        [...messages, { role: 'user', content: userMessage }],
        eegStore.currentData ? { dominant: eegStore.currentData.dominant, quality: eegStore.currentData.quality } : undefined,
      );
      return reply ?? simulateAIResponse(userMessage, eegStore.currentData);
    },
  }))
);

// Simulate AI response when API is not available
function simulateAIResponse(_userMessage: string, eegData: any): string {
  const responses = {
    theta: [
      "I notice you're in a theta-dominant state, which is wonderful for creative exploration. What thoughts are emerging for you right now?",
      "Your brain waves suggest a meditative, receptive state. This is an excellent time for inner exploration.",
      "Theta waves indicate deep relaxation and creativity. Let's explore what your mind is ready to process.",
    ],
    alpha: [
      "You're in a calm, focused alpha state. This is ideal for reflective conversation. How are you feeling?",
      "Alpha waves show you're relaxed yet alert. What would you like to explore today?",
      "Your current state suggests a balanced, peaceful mind. What brings you here today?",
    ],
    beta: [
      "I notice some beta activity, which can indicate active thinking or potential stress. Would you like to try a brief calming exercise?",
      "Your mind seems quite active right now. Let's take a moment to find some stillness together.",
      "Beta waves suggest you're processing a lot. What's on your mind?",
    ],
    gamma: [
      "Remarkable! You're showing gamma wave activity, associated with peak cognition and insight. What are you experiencing?",
      "Gamma states often accompany moments of clarity or transcendence. What insights are emerging?",
      "Your brain is in a highly integrated state. This is a powerful moment for breakthrough thinking.",
    ],
    delta: [
      "Delta waves are typically associated with deep rest. If you're awake, this is quite rare and may indicate deep meditative absorption.",
      "Your brain is showing delta activity, usually seen in deep sleep. If conscious, you may be in a profound meditative state.",
    ],
  };
  
  const dominant = eegData?.dominant || 'alpha';
  const responseOptions = responses[dominant as keyof typeof responses] || responses.alpha;
  return responseOptions[Math.floor(Math.random() * responseOptions.length)];
}

// Generate insights from conversation
function generateInsights(messages: TherapyMessage[]): string[] {
  const insights: string[] = [];
  
  // Analyze EEG contexts
  const eegContexts = messages
    .filter(m => m.eegContext)
    .map(m => m.eegContext!);
  
  if (eegContexts.length > 0) {
    const dominantStates = eegContexts.map(c => c.dominant);
    const mostCommon = dominantStates.sort((a, b) =>
      dominantStates.filter(v => v === a).length - dominantStates.filter(v => v === b).length
    )[0];
    
    insights.push(`Most common brain state during session: ${mostCommon}`);
    
    const avgQuality = eegContexts.reduce((sum, c) => sum + c.quality, 0) / eegContexts.length;
    insights.push(`Average signal quality: ${Math.round(avgQuality)}%`);
  }
  
  return insights;
}

// Selectors
export const selectMessages = (state: TherapistState) => state.messages;
export const selectIsTyping = (state: TherapistState) => state.isTyping;
export const selectCurrentConversation = (state: TherapistState) => state.currentConversation;
