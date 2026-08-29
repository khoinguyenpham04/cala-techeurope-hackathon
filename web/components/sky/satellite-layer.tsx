"use client";

import { MAX_SATELLITE_INSTANCES } from "@/lib/orbit/constants";
import { overlayFor, resolveDotColor } from "@/lib/orbit/overlay";
import {
  getOrbitSamplePair,
  lerpSampleScene,
  sampleAlpha,
} from "@/lib/orbit/sample-buffer";
import type { SatelliteOverlayMap, VisibleSatellite } from "@/lib/orbit/types";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const dummy = new THREE.Object3D();
const scratchColor = new THREE.Color();
const scratchPos = { x: 0, y: 0, z: 0 };

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
  const overlayRef = useRef(overlay);
  const selectedRef = useRef(selectedNoradId);
  const visibleRef = useRef(visible);
  const colorsDirty = useRef(true);
  const paintedEpochMs = useRef(Number.NaN);
  const lastSelectedPainted = useRef<string | null>(null);

  overlayRef.current = overlay;
  selectedRef.current = selectedNoradId;
  visibleRef.current = visible;

  const bindMesh = useCallback((mesh: THREE.InstancedMesh | null) => {
    meshRef.current = mesh;
    if (mesh) mesh.count = 0;
    colorsDirty.current = true;
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

  useEffect(() => {
    colorsDirty.current = true;
  }, [overlay, selectedNoradId]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const pair = getOrbitSamplePair();
    const count = Math.min(pair.curr.count, MAX_SATELLITE_INSTANCES);
    mesh.count = count;
    if (count === 0) return;

    const t = sampleAlpha(performance.now() - pair.curr.arrivedAtMs);
    const selected = selectedRef.current;
    const selectedScale = 2.2 * (1 + 0.14 * Math.sin(state.clock.elapsedTime * 3.1));

    for (let index = 0; index < count; index += 1) {
      lerpSampleScene(scratchPos, pair, index, t);
      dummy.position.set(scratchPos.x, scratchPos.y, scratchPos.z);
      dummy.scale.setScalar(String(pair.curr.noradIds[index]!) === selected ? selectedScale : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    if (
      colorsDirty.current ||
      paintedEpochMs.current !== pair.curr.epochMs ||
      lastSelectedPainted.current !== selected
    ) {
      const overlayMap = overlayRef.current;
      for (let index = 0; index < count; index += 1) {
        const noradId = String(pair.curr.noradIds[index]!);
        const hex =
          noradId === selected ? "#4ade80" : resolveDotColor(overlayFor(overlayMap, noradId));
        scratchColor.set(hex);
        mesh.setColorAt(index, scratchColor);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      colorsDirty.current = false;
      paintedEpochMs.current = pair.curr.epochMs;
      lastSelectedPainted.current = selected;
    }
  });

  return (
    <instancedMesh
      args={[geometry, material, MAX_SATELLITE_INSTANCES]}
      frustumCulled={false}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        const instanceId = event.instanceId;
        const pair = getOrbitSamplePair();
        if (instanceId == null || instanceId >= pair.curr.count) {
          if (instanceId == null || instanceId >= visibleRef.current.length) return;
          onSelect(visibleRef.current[instanceId]!.noradId);
          return;
        }
        onSelect(String(pair.curr.noradIds[instanceId]!));
      }}
      ref={bindMesh}
    />
  );
}
