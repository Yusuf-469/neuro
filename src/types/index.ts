export * from './eeg';
export * from './firebase';

// App State Types
export type Instrument = 'brain' | 'therapist' | 'archive';

export interface AppState {
  currentInstrument: Instrument | null;
  isRecording: boolean;
  isConnecting: boolean;
  isOnline: boolean;
  scrollProgress: number;
}

// UI Types
export interface ScrollSection {
  id: string;
  instrument: Instrument;
  title: string;
  subtitle: string;
  startProgress: number;
  endProgress: number;
}

// API Types
export interface DeepSeekMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DeepSeekResponse {
  id: string;
  choices: Array<{
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
}

// Chart Types
export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface BandChartData {
  band: string;
  data: ChartDataPoint[];
  color: string;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: number;
  duration?: number;
}
