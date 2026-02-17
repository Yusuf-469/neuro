// EEG Data Types

export interface EEGStream {
  timestamp: number;
  channels: {
    tp9: number;   // Left ear
    af7: number;   // Left forehead
    af8: number;   // Right forehead
    tp10: number;  // Right ear
  };
  raw: Float32Array;
}

export interface ProcessedEEG {
  timestamp: number;
  bands: {
    delta: number;    // 0.5-4 Hz (deep sleep)
    theta: number;    // 4-8 Hz (meditation, creativity)
    alpha: number;    // 8-13 Hz (relaxation, focus)
    beta: number;     // 13-30 Hz (active thinking, anxiety)
    gamma: number;    // 30-100 Hz (peak cognition, insight)
  };
  dominant: 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';
  coherence: number;  // Cross-hemisphere sync
  quality: number;    // Signal quality 0-100
}

export type BrainState = 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';

export interface EEGDevice {
  id: string;
  name: string;
  type: 'muse' | 'openbci' | 'generic';
  batteryLevel: number;
  signalQuality: number;
  connected: boolean;
  samplingRate: number;
}

export interface EEGConfig {
  samplingRate: number;
  fftWindowSize: number;
  overlapPercent: number;
  smoothingAlpha: number;
  bufferDuration: number; // seconds
}

export const DEFAULT_EEG_CONFIG: EEGConfig = {
  samplingRate: 256,
  fftWindowSize: 256,
  overlapPercent: 50,
  smoothingAlpha: 0.3,
  bufferDuration: 300, // 5 minutes
};

// Frequency band definitions
export const FREQUENCY_BANDS = {
  delta: { min: 0.5, max: 4, label: 'Delta', color: '#BF5AF2' },
  theta: { min: 4, max: 8, label: 'Theta', color: '#5AC8FA' },
  alpha: { min: 8, max: 13, label: 'Alpha', color: '#30D158' },
  beta: { min: 13, max: 30, label: 'Beta', color: '#FF9500' },
  gamma: { min: 30, max: 100, label: 'Gamma', color: '#FF375F' },
} as const;

// Channel positions for visualization
export const CHANNEL_POSITIONS = {
  tp9: { x: -0.8, y: -0.5, z: 0, label: 'TP9 (Left Ear)' },
  af7: { x: -0.4, y: 0.6, z: 0.3, label: 'AF7 (Left Forehead)' },
  af8: { x: 0.4, y: 0.6, z: 0.3, label: 'AF8 (Right Forehead)' },
  tp10: { x: 0.8, y: -0.5, z: 0, label: 'TP10 (Right Ear)' },
} as const;
