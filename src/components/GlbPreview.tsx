import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const { camera } = useThree();

  useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.metalness = 0;
        material.roughness = 1;
        material.needsUpdate = true;
      }
    });

    // Centraliza e enquadra a câmera automaticamente, igual ao viewer.html
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    scene.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const distance = maxDim * 1.6;
    camera.position.set(distance, distance * 0.8, distance);
    camera.lookAt(0, 0, 0);
  }, [scene, camera]);

  return <primitive object={scene} />;
}

export function GlbPreview({ url }: { url: string | null }) {
  const objectUrlRef = useRef<string | null>(null);

  // Permite passar tanto uma URL remota (edição) quanto um blob local (antes do upload)
  const resolvedUrl = useMemo(() => url, [url]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  if (!resolvedUrl) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl2 bg-vertente-ink text-sm text-white/50">
        Selecione um arquivo GLB para pré-visualizar
      </div>
    );
  }

  return (
    <div className="h-72 overflow-hidden rounded-xl2 bg-vertente-ink">
      <Canvas camera={{ fov: 50 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[10, 15, 10]} intensity={1.8} />
        <Suspense fallback={null}>
          <Model url={resolvedUrl} />
        </Suspense>
        <OrbitControls enablePan enableZoom enableRotate />
      </Canvas>
    </div>
  );
}

export function fileToPreviewUrl(file: File | null) {
  if (!file) return null;
  return URL.createObjectURL(file);
}
