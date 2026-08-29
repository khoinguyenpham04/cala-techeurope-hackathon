"use client";

import { satelliteScenePosition } from "@/lib/orbit/coordinates";
import { overlayFor, resolveDotColor } from "@/lib/orbit/overlay";
import type { SatelliteOverlayMap, VisibleSatellite } from "@/lib/orbit/types";
import { type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const MAX_INSTANCES = 4096;
const dummy = new THREE.Object3D();
const scratchColor = new THREE.Color();

export function SatelliteLayer({
  visible,
  overlay,
  selectedNoradId,
  onSelect,
}: {
  visible: VisibleSatellite[];
  overlay: SatelliteOverlayMap;
  selectedNoradId: string | null;
  onSelect: (noradId: string | null) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const bindMesh = useCallback((mesh: THREE.InstancedMesh | null) => {
    meshRef.current = mesh;
    if (mesh) mesh.count = 0;
  }, []);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.015, 8, 8), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const count = Math.min(visible.length, MAX_INSTANCES);
    mesh.count = count;
    for (let index = 0; index < count; index += 1) {
      const sat = visible[index]!;
      const pos = satelliteScenePosition(
        sat.latitudeDeg,
        sat.longitudeDeg,
        sat.altitudeKm,
      );
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.scale.setScalar(sat.noradId === selectedNoradId ? 2.2 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      const hex =
        sat.noradId === selectedNoradId
          ? "#f8fafc"
          : resolveDotColor(overlayFor(overlay, sat.noradId));
      scratchColor.set(hex);
      mesh.setColorAt(index, scratchColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [overlay, selectedNoradId, visible]);

  return (
    <instancedMesh
      args={[geometry, material, MAX_INSTANCES]}
      frustumCulled={false}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        const instanceId = event.instanceId;
        if (instanceId == null || instanceId >= visible.length) return;
        onSelect(visible[instanceId]!.noradId);
      }}
      ref={bindMesh}
    />
  );
}
