import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, MeshTransmissionMaterial, Float, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { useEEGStore } from '../../stores';

interface BrainProps {
  scrollProgress: number;
  isExpanded: boolean;
  onClick?: () => void;
}

export function Brain({ scrollProgress, isExpanded, onClick }: BrainProps) {
  const groupRef = useRef<THREE.Group>(null);
  const brainRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  const { dominantState, bandPowers, isStreaming } = useEEGStore();
  
  // Load holo brain model
  const { scene } = useGLTF('/models/brain.glb') as any;
  
  // Clone and prepare the model
  const brainModel = useMemo(() => {
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
  
  // Animation based on scroll and EEG state
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Base rotation
    groupRef.current.rotation.y += delta * 0.1;
    
    // Scale based on scroll progress
    const baseScale = 0.5 + scrollProgress * 0.5;
    const targetScale = isExpanded ? 1.5 : baseScale;
    groupRef.current.scale.setScalar(
      THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, delta * 2)
    );
    
    // Position based on scroll
    const targetY = isExpanded ? 0 : -2 + scrollProgress * 2;
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetY,
      delta * 2
    );
    
    // Pulsing effect when streaming
    if (isStreaming && glowRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      glowRef.current.scale.setScalar(pulse);
    }
  });
  
  return (
    <group ref={groupRef} onClick={onClick}>
      <Float
        speed={isExpanded ? 0 : 2}
        rotationIntensity={isExpanded ? 0 : 0.5}
        floatIntensity={isExpanded ? 0 : 0.5}
      >
        {/* Main holo brain model */}
        <primitive
          ref={brainRef}
          object={brainModel}
          scale={1}
          position={[0, 0, 0]}
        />
        
        {/* Glow effect */}
        <Sphere ref={glowRef} args={[1.5, 32, 32]}>
          <meshBasicMaterial
            color={stateColor}
            transparent
            opacity={isStreaming ? 0.15 : 0.05}
            side={THREE.BackSide}
          />
        </Sphere>
        
        {/* Inner glow when streaming */}
        {isStreaming && (
          <Sphere args={[1, 32, 32]}>
            <MeshTransmissionMaterial
              backside
              samples={16}
              thickness={0.5}
              chromaticAberration={0.1}
              anisotropy={0.3}
              distortion={0.5}
              distortionScale={0.5}
              temporalDistortion={0.1}
              iridescence={1}
              iridescenceIOR={1}
              iridescenceThicknessRange={[0, 1400]}
              color={stateColor}
              transparent
              opacity={0.3}
            />
          </Sphere>
        )}
        
        {/* Activity indicators */}
        {isStreaming && (
          <ActivityIndicators bandPowers={bandPowers} />
        )}
      </Float>
    </group>
  );
}

// Activity indicators showing band power levels
function ActivityIndicators({ 
  bandPowers, 
}: { 
  bandPowers: { delta: number; theta: number; alpha: number; beta: number; gamma: number };
}) {
  const bands = ['delta', 'theta', 'alpha', 'beta', 'gamma'] as const;
  const colors = ['#BF5AF2', '#5AC8FA', '#30D158', '#FF9500', '#FF375F'];
  
  return (
    <group position={[0, 0, 0]}>
      {bands.map((band, i) => {
        const angle = (i / bands.length) * Math.PI * 2;
        const radius = 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const power = bandPowers[band] / 100;
        
        return (
          <group key={band} position={[x, 0, z]}>
            <mesh>
              <sphereGeometry args={[0.05 + power * 0.1, 16, 16]} />
              <meshBasicMaterial color={colors[i]} transparent opacity={0.8} />
            </mesh>
            <mesh position={[0, power * 0.5, 0]}>
              <boxGeometry args={[0.02, power, 0.02]} />
              <meshBasicMaterial color={colors[i]} transparent opacity={0.5} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// Preload the model
useGLTF.preload('/models/brain.glb');

export default Brain;