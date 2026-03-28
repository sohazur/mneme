"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { PandaModel } from "./panda-model";

interface PandaSceneProps {
  volumeRef: React.MutableRefObject<number>;
  state: string;
}

function SceneLoader() {
  return (
    <mesh>
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshStandardMaterial color="#7c5cfc" wireframe opacity={0.3} transparent />
    </mesh>
  );
}

export function PandaScene({ volumeRef, state }: PandaSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 2], fov: 45 }}
      style={{ background: "transparent" }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-3, 3, -3]} intensity={0.3} />
      <Environment preset="city" background={false} />

      <Suspense fallback={<SceneLoader />}>
        <PandaModel volumeRef={volumeRef} state={state} />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.8}
        autoRotate={state === "idle"}
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
}
