"use client";

import { useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface PandaModelProps {
  volumeRef: React.MutableRefObject<number>;
  state: string;
}

export function PandaModel({ volumeRef, state }: PandaModelProps) {
  const { scene } = useGLTF("/models/panda.glb");
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const v = volumeRef.current;
    const t = Date.now() * 0.001;

    // Idle breathing
    const breathe = Math.sin(t * 1.5) * 0.008;

    // Audio-reactive animation
    const isSpeaking = state === "speaking";
    const isHearing = state === "hearing";

    // Scale pulse — subtle jaw/breathing effect
    groupRef.current.scale.y = 1 + breathe + (isSpeaking ? v * 0.04 : 0);
    groupRef.current.scale.x = 1 - breathe * 0.5;

    // Bounce on Y
    groupRef.current.position.y = breathe * 0.5 + (isSpeaking ? v * 0.02 : 0);

    // Gentle rotation wiggle when speaking or listening
    const wiggle = isSpeaking ? v * 3 : isHearing ? 0.5 : 0.2;
    groupRef.current.rotation.y = Math.sin(t * 2) * 0.02 * wiggle;
    groupRef.current.rotation.z = Math.sin(t * 1.3) * 0.005 * wiggle;
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/models/panda.glb");
