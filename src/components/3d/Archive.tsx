import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Float, Sphere, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useSessionStore, useEEGStore } from '../../stores';
import type { EEGSession } from '../../types/firebase';

interface ArchiveProps {
  scrollProgress: number;
  isExpanded: boolean;
  onClick?: () => void;
}

export function Archive({ scrollProgress, isExpanded, onClick }: ArchiveProps) {
  const groupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  
  const { sessions } = useSessionStore();
  const { dominantState } = useEEGStore();
  
  // Load dashboard model
  const { scene } = useGLTF('/models/dashboard.glb') as any;
  
  // Clone and prepare the model
  const dashboardModel = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);
  
  // Get color based on dominant state
  const stateColor = useMemo(() => {
    const colors = {
      delta: '#BF5AF2',
      theta: '#5AC8FA',
      alpha: '#30D158',
      beta: '#FF9500',
      gamma: '#FF375F',
    };
    return colors[dominantState] || colors.alpha;
  }, [dominantState]);
  
  // Animation
  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    
    // Base rotation
    groupRef.current.rotation.y += delta * 0.05;
    
    // Scale based on scroll
    const baseScale = 0.5 + scrollProgress * 0.5;
    const targetScale = isExpanded ? 1 : baseScale;
    groupRef.current.scale.setScalar(
      THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, delta * 2)
    );
    
    // Position
    const targetY = isExpanded ? 0 : -2 + scrollProgress * 2;
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetY,
      delta * 2
    );
  });
  
  return (
    <group ref={groupRef} onClick={onClick}>
      <Float
        speed={isExpanded ? 0 : 1}
        rotationIntensity={isExpanded ? 0 : 0.3}
        floatIntensity={isExpanded ? 0 : 0.3}
      >
        {/* Dashboard model */}
        <primitive
          ref={modelRef}
          object={dashboardModel}
          scale={1}
          position={[0, 0, 0]}
        />
        
        {/* Glow effect */}
        <Sphere args={[2, 32, 32]}>
          <meshBasicMaterial
            color={stateColor}
            transparent
            opacity={0.05}
            side={THREE.BackSide}
          />
        </Sphere>
        
        {/* Session indicators as floating orbs */}
        <SessionIndicators sessions={sessions} />
        
        {/* Background sparkles */}
        <Sparkles
          count={50}
          scale={3}
          size={1}
          speed={0.2}
          color="#ffffff"
          opacity={0.3}
        />
      </Float>
    </group>
  );
}

// Session indicators showing recent sessions
function SessionIndicators({ 
  sessions, 
}: { 
  sessions: EEGSession[];
}) {
  const sessionList = sessions.length > 0 ? sessions : generateMockSessions();
  
  return (
    <group>
      {sessionList.slice(0, 10).map((session, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const radius = 1.5;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = 0.5 + Math.sin(i) * 0.2;
        
        const dominantFromSummary = session.summary?.dominantStates?.[0]?.state || 'alpha';
        const color = getStateColor(dominantFromSummary);
        
        return (
          <group key={i} position={[x, y, z]}>
            <mesh>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshBasicMaterial color={color} transparent opacity={0.8} />
            </mesh>
            {/* Glow */}
            <mesh>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.BackSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
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

function generateMockSessions(): EEGSession[] {
  const states = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
  const sessions: EEGSession[] = [];
  
  for (let i = 0; i < 10; i++) {
    sessions.push({
      id: `mock-${i}`,
      userId: 'mock-user',
      startedAt: new Date(Date.now() - i * 86400000) as any,
      endedAt: new Date(Date.now() - i * 86400000 + 1800000) as any,
      duration: 1800 + Math.random() * 1800,
      deviceId: 'mock-device',
      rawDataUrl: null,
      summary: {
        dominantStates: [{
          state: states[Math.floor(Math.random() * states.length)],
          duration: 900,
          percentage: 50,
        }],
        averageQuality: 80 + Math.random() * 20,
        peakCoherence: 0.5 + Math.random() * 0.5,
        totalDataPoints: 1000,
      },
      keyMoments: [],
    });
  }
  
  return sessions;
}

// Preload the model
useGLTF.preload('/models/dashboard.glb');

export default Archive;