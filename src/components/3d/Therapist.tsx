import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Sphere, Float, Sparkles, MeshDistortMaterial, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useTherapistStore, useEEGStore } from '../../stores';

interface TherapistProps {
  scrollProgress: number;
  isExpanded: boolean;
  onClick?: () => void;
}

export function Therapist({ scrollProgress, isExpanded, onClick }: TherapistProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  
  const { isTyping, isListening, isSpeaking } = useTherapistStore();
  const { dominantState } = useEEGStore();
  
  // Load therapist model (medical doctor)
  const { scene } = useGLTF('/models/therapist.glb') as any;
  
  // Clone and prepare the model
  const therapistModel = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);
  
  // Get color based on EEG state - green for alpha (relaxed state)
  const stateColor = useMemo(() => {
    const colors = {
      delta: '#BF5AF2',
      theta: '#5AC8FA',
      alpha: '#30D158', // Green for relaxed state
      beta: '#FF9500',
      gamma: '#FF375F',
    };
    return colors[dominantState] || colors.alpha;
  }, [dominantState]);
  
  // Particle positions
  const particlePositions = useMemo(() => {
    const count = 200;
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.5 + Math.random() * 0.5;
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    
    return positions;
  }, []);
  
  // Animation
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Base rotation
    groupRef.current.rotation.y += delta * 0.05;
    
    // Scale based on scroll
    const baseScale = 0.5 + scrollProgress * 0.5;
    const targetScale = isExpanded ? 1.2 : baseScale;
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
    
    // Core breathing animation
    if (coreRef.current) {
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      coreRef.current.scale.setScalar(breathe);
      
      // Distortion based on state
      const material = coreRef.current.material as any;
      if (material && typeof material.distort !== 'undefined') {
        material.distort = isSpeaking ? 0.4 : isTyping ? 0.2 : 0.1;
        material.speed = isSpeaking ? 5 : isTyping ? 2 : 1;
      }
    }
    
    // Aura pulsing
    if (auraRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      auraRef.current.scale.setScalar(pulse);
    }
    
    // Particle animation
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i < positions.length; i += 3) {
        // Gentle floating motion
        positions[i + 1] += Math.sin(state.clock.elapsedTime + i) * 0.001;
        
        // Rush inward when listening
        if (isListening) {
          const dist = Math.sqrt(positions[i] ** 2 + positions[i + 1] ** 2 + positions[i + 2] ** 2);
          if (dist > 0.5) {
            positions[i] -= (positions[i] / dist) * 0.01;
            positions[i + 1] -= (positions[i + 1] / dist) * 0.01;
            positions[i + 2] -= (positions[i + 2] / dist) * 0.01;
          }
        }
        
        // Explode outward when speaking
        if (isSpeaking) {
          const dist = Math.sqrt(positions[i] ** 2 + positions[i + 1] ** 2 + positions[i + 2] ** 2);
          if (dist < 3) {
            positions[i] += (positions[i] / dist) * 0.02;
            positions[i + 1] += (positions[i + 1] / dist) * 0.02;
            positions[i + 2] += (positions[i + 2] / dist) * 0.02;
          }
        }
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });
  
  return (
    <group ref={groupRef} onClick={onClick}>
      <Float
        speed={isExpanded ? 0 : 1}
        rotationIntensity={isExpanded ? 0 : 0.3}
        floatIntensity={isExpanded ? 0 : 0.3}
      >
        {/* Green outer sphere - main container */}
        <Sphere args={[1.2, 64, 64]} position={[0, 0, 0]}>
          <MeshTransmissionMaterial
            backside
            samples={16}
            thickness={0.5}
            chromaticAberration={0.5}
            anisotropy={0.5}
            distortion={1}
            distortionScale={0.5}
            temporalDistortion={0.2}
            color="#30D158"
            transparent
            opacity={0.3}
          />
        </Sphere>
        
        {/* Therapist model inside the green sphere */}
        <primitive
          object={therapistModel}
          scale={0.8}
          position={[0, -0.3, 0]}
        />
        
        {/* Core orb for interaction feedback */}
        <Sphere ref={coreRef} args={[0.3, 64, 64]} position={[0, 0.8, 0]}>
          <MeshDistortMaterial
            color={stateColor}
            attach="material"
            distort={0.2}
            speed={2}
            roughness={0.1}
            metalness={0.1}
            transparent
            opacity={0.9}
          />
        </Sphere>
        
        {/* Inner glow */}
        <Sphere args={[0.25, 32, 32]} position={[0, 0.8, 0]}>
          <MeshTransmissionMaterial
            backside
            samples={16}
            thickness={0.5}
            chromaticAberration={0.5}
            anisotropy={0.5}
            distortion={1}
            distortionScale={0.5}
            temporalDistortion={0.2}
            color={stateColor}
            transparent
            opacity={0.5}
          />
        </Sphere>
        
        {/* Outer aura */}
        <Sphere ref={auraRef} args={[0.5, 32, 32]} position={[0, 0.8, 0]}>
          <meshBasicMaterial
            color={stateColor}
            transparent
            opacity={0.1}
            side={THREE.BackSide}
          />
        </Sphere>
        
        {/* Particles */}
        <points ref={particlesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[particlePositions, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            color={stateColor}
            size={0.02}
            transparent
            opacity={0.8}
            sizeAttenuation
          />
        </points>
        
        {/* Sparkles */}
        <Sparkles
          count={50}
          scale={2}
          size={2}
          speed={0.3}
          color={stateColor}
          opacity={0.5}
        />
        
        {/* Activity ring when typing */}
        {isTyping && (
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.8, 0]}>
            <torusGeometry args={[0.6, 0.02, 16, 100]} />
            <meshBasicMaterial color={stateColor} transparent opacity={0.5} />
          </mesh>
        )}
        
        {/* Sound wave visualization when speaking */}
        {isSpeaking && (
          <SoundWaves color={stateColor} />
        )}
      </Float>
    </group>
  );
}

// Sound wave visualization
function SoundWaves({ color }: { color: string }) {
  const wavesRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!wavesRef.current) return;
    
    wavesRef.current.children.forEach((wave, i) => {
      const mesh = wave as THREE.Mesh;
      const scale = 1 + ((state.clock.elapsedTime * 2 + i * 0.5) % 2);
      mesh.scale.setScalar(scale);
      
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = Math.max(0, 0.5 - scale * 0.2);
      }
    });
  });
  
  return (
    <group ref={wavesRef} position={[0, 0.8, 0]}>
      {[0, 1, 2].map((i) => (
        <Sphere key={i} args={[0.4, 32, 32]}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.3}
            side={THREE.BackSide}
            wireframe
          />
        </Sphere>
      ))}
    </group>
  );
}

// Preload the model
useGLTF.preload('/models/therapist.glb');

export default Therapist;