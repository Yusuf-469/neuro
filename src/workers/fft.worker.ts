// FFT Web Worker for real-time EEG processing
// This runs in a separate thread to avoid blocking the UI

import type { ProcessedEEG, BrainState } from '../types/eeg';
import { FREQUENCY_BANDS } from '../types/eeg';

// FFT implementation (Cooley-Tukey algorithm)
class FFT {
  private n: number;
  private cosTable: Float64Array;
  private sinTable: Float64Array;

  constructor(n: number) {
    this.n = n;
    this.cosTable = new Float64Array(n / 2);
    this.sinTable = new Float64Array(n / 2);
    
    // Precompute twiddle factors
    for (let i = 0; i < n / 2; i++) {
      const angle = (-2 * Math.PI * i) / n;
      this.cosTable[i] = Math.cos(angle);
      this.sinTable[i] = Math.sin(angle);
    }
  }

  // Perform FFT on real-valued input
  realFFT(input: Float32Array): { real: Float32Array; imag: Float32Array } {
    const n = this.n;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    
    // Copy input to real array
    for (let i = 0; i < n; i++) {
      real[i] = input[i] || 0;
      imag[i] = 0;
    }
    
    // Bit-reversal permutation
    for (let i = 0, j = 0; i < n; i++) {
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
      let k = n >> 1;
      while (k && j >= k) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }
    
    // Cooley-Tukey FFT
    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1;
      for (let i = 0; i < n; i += len) {
        for (let j = 0; j < halfLen; j++) {
          const idx = j * (n / len);
          const cos = this.cosTable[idx];
          const sin = this.sinTable[idx];
          
          const tReal = real[i + j + halfLen] * cos - imag[i + j + halfLen] * sin;
          const tImag = real[i + j + halfLen] * sin + imag[i + j + halfLen] * cos;
          
          real[i + j + halfLen] = real[i + j] - tReal;
          imag[i + j + halfLen] = imag[i + j] - tImag;
          real[i + j] += tReal;
          imag[i + j] += tImag;
        }
      }
    }
    
    return { real, imag };
  }

  // Compute power spectrum
  powerSpectrum(real: Float32Array, imag: Float32Array): Float32Array {
    const n = this.n / 2 + 1;
    const power = new Float32Array(n);
    
    for (let i = 0; i < n; i++) {
      power[i] = real[i] * real[i] + imag[i] * imag[i];
    }
    
    return power;
  }
}

// EEG Processor class
class EEGProcessor {
  private fft: FFT;
  private sampleRate: number;
  private smoothingAlpha: number;
  private previousBands: { [key: string]: number } | null = null;
  private buffer: Float32Array[] = [];
  private bufferSize: number;

  constructor(sampleRate: number = 256, fftSize: number = 256, smoothingAlpha: number = 0.3) {
    this.fft = new FFT(fftSize);
    this.sampleRate = sampleRate;
    this.smoothingAlpha = smoothingAlpha;
    this.bufferSize = fftSize;
  }

  // Add sample to buffer
  addSample(sample: Float32Array): boolean {
    this.buffer.push(sample);
    
    if (this.buffer.length >= this.bufferSize) {
      return true; // Ready to process
    }
    return false;
  }

  // Process buffer and return band powers
  process(): ProcessedEEG | null {
    if (this.buffer.length < this.bufferSize) {
      return null;
    }

    // Average across channels for simplicity
    const averagedBuffer = new Float32Array(this.bufferSize);
    for (let i = 0; i < this.bufferSize; i++) {
      const sample = this.buffer[i];
      let sum = 0;
      for (let j = 0; j < sample.length; j++) {
        sum += sample[j];
      }
      averagedBuffer[i] = sum / sample.length;
    }

    // Apply window function (Hanning)
    const windowed = this.applyHanningWindow(averagedBuffer);

    // Compute FFT
    const { real, imag } = this.fft.realFFT(windowed);

    // Compute power spectrum
    const power = this.fft.powerSpectrum(real, imag);

    // Compute band powers
    const bands = this.computeBandPowers(power);

    // Apply smoothing
    const smoothedBands = this.applySmoothing(bands);

    // Determine dominant state
    const dominant = this.getDominantState(smoothedBands);

    // Compute coherence (simplified - correlation between hemispheres)
    const coherence = this.computeCoherence();

    // Compute signal quality
    const quality = this.computeSignalQuality(power);

    // Clear buffer
    this.buffer = [];

    return {
      timestamp: Date.now(),
      bands: {
        delta: smoothedBands['delta'] || 0,
        theta: smoothedBands['theta'] || 0,
        alpha: smoothedBands['alpha'] || 0,
        beta: smoothedBands['beta'] || 0,
        gamma: smoothedBands['gamma'] || 0,
      },
      dominant,
      coherence,
      quality,
    };
  }

  // Apply Hanning window
  private applyHanningWindow(signal: Float32Array): Float32Array {
    const n = signal.length;
    const windowed = new Float32Array(n);
    
    for (let i = 0; i < n; i++) {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
      windowed[i] = signal[i] * window;
    }
    
    return windowed;
  }

  // Compute band powers from power spectrum
  private computeBandPowers(power: Float32Array): { [key: string]: number } {
    const bands: { [key: string]: number } = {};
    const freqResolution = this.sampleRate / this.bufferSize;

    for (const [bandName, bandDef] of Object.entries(FREQUENCY_BANDS)) {
      const startBin = Math.floor(bandDef.min / freqResolution);
      const endBin = Math.min(Math.ceil(bandDef.max / freqResolution), power.length - 1);
      
      let bandPower = 0;
      let count = 0;
      
      for (let i = startBin; i <= endBin; i++) {
        bandPower += power[i];
        count++;
      }
      
      bands[bandName] = count > 0 ? bandPower / count : 0;
    }

    // Normalize to percentages
    const totalPower = Object.values(bands).reduce((sum, p) => sum + p, 0);
    if (totalPower > 0) {
      for (const band of Object.keys(bands)) {
        bands[band] = (bands[band] / totalPower) * 100;
      }
    }

    return bands;
  }

  // Apply exponential moving average smoothing
  private applySmoothing(bands: { [key: string]: number }): { [key: string]: number } {
    if (!this.previousBands) {
      this.previousBands = { ...bands };
      return bands;
    }

    const smoothed: { [key: string]: number } = {};
    for (const [band, power] of Object.entries(bands)) {
      smoothed[band] = this.smoothingAlpha * power + (1 - this.smoothingAlpha) * (this.previousBands[band] || 0);
    }

    this.previousBands = { ...smoothed };
    return smoothed;
  }

  // Get dominant brain state
  private getDominantState(bands: { [key: string]: number }): BrainState {
    let maxBand: BrainState = 'alpha';
    let maxPower = 0;

    for (const [band, power] of Object.entries(bands)) {
      if (power > maxPower) {
        maxPower = power;
        maxBand = band as BrainState;
      }
    }

    return maxBand;
  }

  // Compute coherence (simplified)
  private computeCoherence(): number {
    // In a real implementation, this would compute cross-hemisphere correlation
    // For now, return a simulated value
    return 0.5 + Math.random() * 0.4;
  }

  // Compute signal quality
  private computeSignalQuality(power: Float32Array): number {
    // Check for artifacts (very high power in certain bands)
    const totalPower = power.reduce((sum, p) => sum + p, 0);
    const dcPower = power[0]; // DC component
    
    // Quality decreases with high DC component (indicating poor contact)
    const quality = Math.max(0, Math.min(100, 100 - (dcPower / totalPower) * 100));
    
    return Math.round(quality);
  }

  // Clear all buffers
  clear(): void {
    this.buffer = [];
    this.previousBands = null;
  }
}

// Create processor instance
const processor = new EEGProcessor(256, 256, 0.3);

// Handle messages from main thread
self.onmessage = (event: MessageEvent) => {
  const { type, data } = event.data;

  switch (type) {
    case 'process':
      // Add sample to buffer
      const ready = processor.addSample(data.raw);
      
      if (ready) {
        const result = processor.process();
        if (result) {
          self.postMessage({
            type: 'processed',
            data: result,
          });
        }
      }
      break;

    case 'clear':
      processor.clear();
      break;

    case 'config':
      // Update configuration
      if (data.sampleRate || data.fftSize || data.smoothingAlpha) {
        // Recreate processor with new config
        // (In production, would update existing processor)
      }
      break;

    default:
      console.warn('Unknown message type:', type);
  }
};

// Export for TypeScript
export {};