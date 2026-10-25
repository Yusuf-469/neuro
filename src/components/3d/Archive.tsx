import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Float, Sphere, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { loadNeuroModel, predictProba } from '../../lib/neuroModel';

interface ArchiveProps {
  scrollProgress: number;
  isExpanded: boolean;
  onClick?: () => void;
}

const HEALTHY = '#00D4FF';
const MOOD = '#FF006E';
const ACCENT = '#FFD60A';

// The archive scene now visualises the research prediction model:
// one orb per held-out test subject, coloured by the model's prediction.
export function Archive({ scrollProgress, isExpanded, onClick }: ArchiveProps) {
  const groupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);

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
            color={ACCENT}
            transparent
            opacity={0.05}
            side={THREE.BackSide}
          />
        </Sphere>

        {/* Model predictions as floating orbs */}
        <PredictionOrbs />

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

interface Orb {
  pos: [number, number, number];
  color: string;
  size: number;
  correct: boolean;
}

// One orb per held-out subject, on two rings: healthy-predicted inside, mood-predicted outside.
function PredictionOrbs() {
  const [orbs, setOrbs] = useState<Orb[]>([]);

  useEffect(() => {
    let alive = true;
    loadNeuroModel()
      .then((model) => {
        if (!alive) return;
        const preds = model.subjects.map((s) => {
          const p = predictProba(model, s.z);
          return { p, pred: p >= 0.5 ? 1 : 0, correct: (p >= 0.5 ? 1 : 0) === s.truth };
        });
        const rings = [preds.filter((x) => x.pred === 0), preds.filter((x) => x.pred === 1)];
        const out: Orb[] = [];
        rings.forEach((ring, r) => {
          const radius = r === 0 ? 1.15 : 1.65;
          ring.forEach((x, i) => {
            const a = (i / ring.length) * Math.PI * 2 + r * 0.3;
            const confidence = Math.abs(x.p - 0.5) * 2; // 0..1
            out.push({
              pos: [Math.cos(a) * radius, 0.35 + Math.sin(i * 1.7) * 0.25, Math.sin(a) * radius],
              color: x.pred ? MOOD : HEALTHY,
              size: 0.025 + confidence * 0.035,
              correct: x.correct,
            });
          });
        });
        setOrbs(out);
      })
      .catch(() => setOrbs([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <group>
      {orbs.map((o, i) => (
        <group key={i} position={o.pos}>
          <mesh>
            <sphereGeometry args={[o.size, 16, 16]} />
            <meshBasicMaterial color={o.color} transparent opacity={o.correct ? 0.9 : 0.35} />
          </mesh>
          {/* Glow */}
          <mesh>
            <sphereGeometry args={[o.size * 2, 8, 8]} />
            <meshBasicMaterial color={o.color} transparent opacity={o.correct ? 0.2 : 0.08} side={THREE.BackSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Preload the model
useGLTF.preload('/models/dashboard.glb');

export default Archive;
