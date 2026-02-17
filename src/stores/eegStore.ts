import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { EEGStream, ProcessedEEG, EEGDevice, BrainState, EEGConfig } from '../types/eeg';

interface EEGState {
  // Device state
  device: EEGDevice | null;
  isConnecting: boolean;
  connectionError: string | null;
  
  // Stream state
  isStreaming: boolean;
  currentData: ProcessedEEG | null;
  buffer: ProcessedEEG[];
  rawBuffer: EEGStream[];
  
  // Configuration
  config: EEGConfig;
  
  // Real-time metrics
  signalQuality: number;
  dominantState: BrainState;
  coherence: number;
  
  // Band powers (real-time)
  bandPowers: {
    delta: number;
    theta: number;
    alpha: number;
    beta: number;
    gamma: number;
  };
  
  // Actions
  setDevice: (device: EEGDevice | null) => void;
  setConnecting: (connecting: boolean) => void;
  setConnectionError: (error: string | null) => void;
  startStreaming: () => void;
  stopStreaming: () => void;
  addEEGData: (data: ProcessedEEG) => void;
  addRawData: (data: EEGStream) => void;
  updateBandPowers: (bands: EEGState['bandPowers']) => void;
  setSignalQuality: (quality: number) => void;
  setDominantState: (state: BrainState) => void;
  setCoherence: (coherence: number) => void;
  clearBuffer: () => void;
  updateConfig: (config: Partial<EEGConfig>) => void;
}

const DEFAULT_CONFIG: EEGConfig = {
  samplingRate: 256,
  fftWindowSize: 256,
  overlapPercent: 50,
  smoothingAlpha: 0.3,
  bufferDuration: 300,
};

export const useEEGStore = create<EEGState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    device: null,
    isConnecting: false,
    connectionError: null,
    isStreaming: false,
    currentData: null,
    buffer: [],
    rawBuffer: [],
    config: DEFAULT_CONFIG,
    signalQuality: 0,
    dominantState: 'alpha',
    coherence: 0,
    bandPowers: {
      delta: 0,
      theta: 0,
      alpha: 0,
      beta: 0,
      gamma: 0,
    },
    
    // Actions
    setDevice: (device) => set({ device }),
    
    setConnecting: (isConnecting) => set({ isConnecting }),
    
    setConnectionError: (connectionError) => set({ connectionError }),
    
    startStreaming: () => set({ isStreaming: true, buffer: [], rawBuffer: [] }),
    
    stopStreaming: () => set({ isStreaming: false }),
    
    addEEGData: (data) => {
      const { buffer, config } = get();
      const maxBufferLength = config.bufferDuration * (1000 / 50); // ~50ms per sample
      
      set({
        currentData: data,
        buffer: [...buffer.slice(-maxBufferLength + 1), data],
        dominantState: data.dominant,
        signalQuality: data.quality,
        coherence: data.coherence,
        bandPowers: data.bands,
      });
    },
    
    addRawData: (data) => {
      const { rawBuffer, config } = get();
      const maxRawLength = config.samplingRate * config.bufferDuration;
      
      set({
        rawBuffer: [...rawBuffer.slice(-maxRawLength + 1), data],
      });
    },
    
    updateBandPowers: (bandPowers) => set({ bandPowers }),
    
    setSignalQuality: (signalQuality) => set({ signalQuality }),
    
    setDominantState: (dominantState) => set({ dominantState }),
    
    setCoherence: (coherence) => set({ coherence }),
    
    clearBuffer: () => set({ buffer: [], rawBuffer: [], currentData: null }),
    
    updateConfig: (newConfig) => set((state) => ({
      config: { ...state.config, ...newConfig },
    })),
  }))
);

// Selectors for optimized re-renders
export const selectDevice = (state: EEGState) => state.device;
export const selectIsStreaming = (state: EEGState) => state.isStreaming;
export const selectCurrentData = (state: EEGState) => state.currentData;
export const selectBandPowers = (state: EEGState) => state.bandPowers;
export const selectSignalQuality = (state: EEGState) => state.signalQuality;
export const selectDominantState = (state: EEGState) => state.dominantState;
