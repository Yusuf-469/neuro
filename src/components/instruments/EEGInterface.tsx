import { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArrowLeft, Bluetooth, Battery, Signal, Play, Square, Circle, Brain, Activity, Wifi, WifiOff, Sparkles } from 'lucide-react';
import { Brain as BrainModel } from '../3d';
import { useEEGStore, useSessionStore, useUserStore } from '../../stores';
import { eegBluetooth } from '../../lib/eegBluetooth';
import { Button, IconButton } from '../ui/Button';
import type { ProcessedEEG } from '../../types/eeg';

interface EEGInterfaceProps {
  onBack: () => void;
}

export function EEGInterface({ onBack }: EEGInterfaceProps) {
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const {
    device,
    isStreaming,
    bandPowers,
    signalQuality,
    dominantState,
    coherence,
    setDevice,
    setConnecting,
    setConnectionError,
    startStreaming,
    stopStreaming,
    addEEGData,
    clearBuffer,
  } = useEEGStore();
  
  const { startSession, endSession, currentSession } = useSessionStore();
  const { user } = useUserStore();
  
  // Timer for session duration
  useEffect(() => {
    if (isStreaming) {
      timerRef.current = setInterval(() => {
        setSessionDuration((d) => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isStreaming]);
  
  // Simulate EEG data when streaming
  useEffect(() => {
    if (isStreaming) {
      simulationRef.current = setInterval(() => {
        const data = simulateEEGData();
        addEEGData(data);
      }, 50); // 20 FPS update rate
    } else {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
      }
    }
    
    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
      }
    };
  }, [isStreaming, addEEGData]);
  
  // Handle device connection
  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setConnecting(true);
    
    try {
      const connectedDevice = await eegBluetooth.connect();
      setDevice(connectedDevice);
      setConnectionError(null);
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionError('Failed to connect to EEG device');
    } finally {
      setIsConnecting(false);
      setConnecting(false);
    }
  }, [setDevice, setConnecting, setConnectionError]);
  
  // Handle session start
  const handleStartSession = useCallback(() => {
    startSession(device?.id || 'simulated');
    startStreaming();
    setSessionDuration(0);
  }, [device, startSession, startStreaming]);
  
  // Handle session end
  const handleEndSession = useCallback(() => {
    stopStreaming();
    clearBuffer();
    
    if (currentSession) {
      endSession();
    }
  }, [stopStreaming, clearBuffer, currentSession, endSession]);
  
  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const stateColor = getStateColor(dominantState);
  const totalBandPower = Object.values(bandPowers).reduce((a, b) => a + b, 0);
  
  return (
    <div className="fixed inset-0 bg-void z-50 flex flex-col overflow-hidden animate-fade-in-up">
      {/* Animated background */}
      <div className="absolute inset-0 grid-bg opacity-50" />
      <div className="absolute inset-0 hex-pattern opacity-30" />
      
      {/* Animated gradient orbs */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full opacity-30 blur-[120px] pointer-events-none transition-all duration-1000 animate-breathe"
        style={{
          background: `radial-gradient(circle, ${stateColor}60 0%, transparent 70%)`,
          left: '25%',
          top: '15%',
        }}
      />
      <div 
        className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[100px] pointer-events-none transition-all duration-1000"
        style={{
          background: `radial-gradient(circle, #00D4FF 0%, transparent 70%)`,
          right: '10%',
          bottom: '20%',
        }}
      />
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan/30 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${4 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>
      
      {/* Header */}
      <header className="relative z-20 flex items-center justify-between p-5 border-b border-white/5">
        <IconButton
          onClick={onBack}
          variant="ghost"
          ariaLabel="Go back"
          className="group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </IconButton>
        
        <div className="flex items-center gap-4">
          {/* Signal quality */}
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl glass-panel border border-white/10 animate-scale-in">
            <div className="relative">
              <Signal 
                className="w-4 h-4" 
                style={{ color: signalQuality > 80 ? '#30D158' : signalQuality > 50 ? '#FF9500' : '#FF375F' }} 
              />
              <div 
                className="absolute inset-0 animate-pulse-ring rounded-full"
                style={{ 
                  background: signalQuality > 80 ? '#30D158' : signalQuality > 50 ? '#FF9500' : '#FF375F',
                }} 
              />
            </div>
            <span className="text-sm font-medium">
              {signalQuality}%
            </span>
          </div>
          
          {/* Session timer */}
          {isStreaming && (
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl glass-panel border border-gamma/20 animate-scale-in">
              <Circle className="w-3 h-3 text-gamma animate-pulse" />
              <span className="text-lg font-mono font-semibold tracking-wider">
                {formatDuration(sessionDuration)}
              </span>
            </div>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <div className="flex-1 flex relative z-10">
        {/* 3D Brain visualization */}
        <div className="flex-1 relative">
          <Canvas
            camera={{ position: [0, 0, 5], fov: 50 }}
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <BrainModel
              scrollProgress={1}
              isExpanded={true}
              onClick={() => {}}
            />
            <OrbitControls
              enableZoom={true}
              enablePan={false}
              minDistance={3}
              maxDistance={8}
            />
          </Canvas>
          
          {/* State indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-in-up">
            <div className="px-8 py-4 rounded-2xl glass-panel border border-white/10">
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4" style={{ color: stateColor }} />
                <span className="text-sm text-text-secondary">Current State</span>
                <span 
                  className="text-lg font-semibold uppercase tracking-wider animate-glow-pulse"
                  style={{ color: stateColor }}
                >
                  {dominantState}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Control panel */}
        <div className="w-[420px] flex flex-col relative overflow-hidden">
          {/* Glass panel background */}
          <div className="absolute inset-0 glass-panel border-l border-white/5" />
          
          <div className="flex-1 p-6 relative z-10 overflow-y-auto custom-scrollbar space-y-6">
            {/* Band powers */}
            <div className="futuristic-card p-6 animate-fade-in-up">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm text-text-secondary font-medium flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan" />
                  Brain Waves
                </h3>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan/10 border border-cyan/20">
                  <div className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
                  <span className="text-xs text-cyan font-medium">Live</span>
                </div>
              </div>
              
              <div className="space-y-4">
                {Object.entries(bandPowers).map(([band, power], index) => {
                  const percentage = totalBandPower > 0 ? (power / totalBandPower) * 100 : 0;
                  const color = getStateColor(band);
                  const isActive = dominantState === band;
                  
                  return (
                    <div 
                      key={band} 
                      className={`relative transition-all duration-300 ${isActive ? 'scale-[1.02]' : ''}`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {isActive && (
                            <div 
                              className="w-2 h-2 rounded-full animate-pulse shadow-lg" 
                              style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} 
                            />
                          )}
                          <span className="text-sm capitalize font-medium text-text-primary">{band}</span>
                          <span className="text-xs text-text-tertiary">{getBandHz(band)}</span>
                        </div>
                        <span className="text-lg font-mono font-semibold" style={{ color }}>
                          {Math.round(percentage)}%
                        </span>
                      </div>
                      <div className="h-3 bg-surface-3/50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 relative overflow-hidden"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: color,
                            boxShadow: `0 0 15px ${color}60`,
                          }}
                        >
                          {/* Shimmer effect */}
                          <div 
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                            style={{ animationDelay: `${index * 200}ms` }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-text-tertiary mt-2 ml-5">
                        {getBandDescription(band)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Coherence meter */}
            <div className="futuristic-card p-6 animate-fade-in-up delay-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm text-text-secondary font-medium flex items-center gap-2">
                  <Brain className="w-4 h-4 text-cyan" />
                  Coherence
                </h3>
                <span className="text-xl font-mono font-bold text-cyan">
                  {(coherence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-4 bg-surface-3/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 relative"
                  style={{
                    width: `${coherence * 100}%`,
                    background: `linear-gradient(90deg, ${stateColor} 0%, #00D4FF 50%, #9D00FF 100%)`,
                    boxShadow: `0 0 20px ${stateColor}60`,
                  }}
                />
              </div>
              <p className="text-xs text-text-tertiary mt-3">
                Cross-hemisphere synchronization
              </p>
            </div>
            
            {/* Device status */}
            <div className="futuristic-card p-6 animate-fade-in-up delay-300">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm text-text-secondary font-medium flex items-center gap-2">
                  {device ? <Wifi className="w-4 h-4 text-alpha" /> : <WifiOff className="w-4 h-4 text-text-tertiary" />}
                  Device Status
                </h3>
                {device ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-alpha/10 border border-alpha/20">
                    <div className="w-2 h-2 rounded-full bg-alpha animate-pulse" />
                    <span className="text-xs text-alpha font-medium">Connected</span>
                  </div>
                ) : (
                  <span className="text-xs text-text-tertiary">Not connected</span>
                )}
              </div>
              
              {device ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-surface-2/30 border border-white/5">
                    <div className="flex items-center gap-3">
                      <Bluetooth className="w-5 h-5 text-cyan" />
                      <span className="text-sm font-medium text-text-primary">{device.name}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-alpha/10">
                      <Battery className="w-4 h-4 text-alpha" />
                      <span className="text-xs text-alpha font-medium">87%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-text-tertiary px-1">
                    <span>Type: <span className="text-text-secondary">{device.type}</span></span>
                    <span>ID: <span className="text-text-secondary font-mono">{device.id.slice(0, 8)}...</span></span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-2/50 flex items-center justify-center">
                    <WifiOff className="w-8 h-8 text-text-tertiary" />
                  </div>
                  <p className="text-sm text-text-tertiary">No device connected</p>
                  <p className="text-xs text-text-tertiary/50 mt-1">Connect a headset to begin</p>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="space-y-3 pt-2 animate-fade-in-up delay-400">
              {!device && (
                <Button
                  onClick={handleConnect}
                  loading={isConnecting}
                  fullWidth
                  icon={<Bluetooth className="w-4 h-4" />}
                  glow="cyan"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Headset'}
                </Button>
              )}
              
              {!isStreaming ? (
                <Button
                  onClick={handleStartSession}
                  disabled={!device && !user}
                  fullWidth
                  variant="success"
                  icon={<Play className="w-4 h-4" />}
                  glow="alpha"
                >
                  Start Session
                </Button>
              ) : (
                <Button
                  onClick={handleEndSession}
                  fullWidth
                  variant="danger"
                  icon={<Square className="w-4 h-4" />}
                  glow="gamma"
                >
                  End Session
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simulate EEG data for demo
function simulateEEGData(): ProcessedEEG {
  const states: Array<'delta' | 'theta' | 'alpha' | 'beta' | 'gamma'> = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
  const dominant = states[Math.floor(Math.random() * states.length)];
  
  // Generate band powers with dominant state having higher value
  const bands = {
    delta: Math.random() * 20,
    theta: Math.random() * 30,
    alpha: Math.random() * 40,
    beta: Math.random() * 25,
    gamma: Math.random() * 15,
  };
  
  // Boost the dominant band
  bands[dominant] += 30 + Math.random() * 20;
  
  return {
    timestamp: Date.now(),
    bands,
    dominant,
    coherence: 0.5 + Math.random() * 0.4,
    quality: 75 + Math.floor(Math.random() * 20),
  };
}

// Helper functions
function getStateColor(state: string): string {
  const colors: Record<string, string> = {
    delta: '#BF5AF2',
    theta: '#5AC8FA',
    alpha: '#30D158',
    beta: '#FF9500',
    gamma: '#FF375F',
  };
  return colors[state] || colors.alpha;
}

function getBandHz(band: string): string {
  const hz: Record<string, string> = {
    delta: '0.5-4 Hz',
    theta: '4-8 Hz',
    alpha: '8-13 Hz',
    beta: '13-30 Hz',
    gamma: '30-100 Hz',
  };
  return hz[band] || '';
}

function getBandDescription(band: string): string {
  const descriptions: Record<string, string> = {
    delta: 'Deep sleep, unconscious processing',
    theta: 'Meditation, creativity, emotional',
    alpha: 'Relaxation, calm focus, flow state',
    beta: 'Active thinking, concentration',
    gamma: 'Peak cognition, insight, transcendence',
  };
  return descriptions[band] || '';
}

export default EEGInterface;