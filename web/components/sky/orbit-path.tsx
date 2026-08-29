"use client";

import { ORBIT_REFRESH_MS, sampleOrbitScenePoints } from "@/lib/orbit/orbit-path";
import type { SlimOmm } from "@/lib/orbit/types";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

const ORBIT_COLOR = "#4ade80";
const LINE_OPACITY = 0.92;

function packPositions(points: Array<[number, number, number]>): Float32Array {
  const packed = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    packed[i * 3] = p[0];
    packed[i * 3 + 1] = p[1];
    packed[i * 3 + 2] = p[2];
  }
  return packed;
}

function writeLinePositions(line: Line2, points: Array<[number, number, number]>) {
  line.geometry.setPositions(packPositions(points));
  line.computeLineDistances();
}

function disposeLineGeometry(line: Line2) {
  const previous = line.geometry;
  line.geometry = new LineGeometry();
  previous.dispose();
}

export function OrbitPath({ omm }: { omm: SlimOmm | null }) {
  const size = useThree((state) => state.size);
  const noradId = omm ? String(omm.NORAD_CAT_ID) : null;
  const [epochMs, setEpochMs] = useState(() => Date.now());
  const lastPoints = useRef<Array<[number, number, number]>>([]);
  const prevNorad = useRef<string | null>(noradId);

  useEffect(() => {
    if (!noradId) return;
    setEpochMs(Date.now());
    const id = window.setInterval(() => setEpochMs(Date.now()), ORBIT_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [noradId]);

  const points = useMemo(
    () => (omm ? sampleOrbitScenePoints(omm, epochMs) : []),
    [epochMs, omm],
  );

  const line = useMemo(() => {
    const geometry = new LineGeometry();
    const material = new LineMaterial({
      color: ORBIT_COLOR,
      linewidth: 1.8,
      transparent: true,
      opacity: 0,
      depthTest: true,
      toneMapped: false,
      dashed: false,
      worldUnits: false,
    });
    const object = new Line2(geometry, material);
    object.frustumCulled = false;
    object.renderOrder = 2;
    object.visible = false;
    return object;
  }, []);

  useLayoutEffect(() => {
    (line.material as LineMaterial).resolution.set(size.width, size.height);
  }, [line, size.height, size.width]);

  useLayoutEffect(() => {
    if (prevNorad.current !== noradId) {
      (line.material as LineMaterial).opacity = 0;
      prevNorad.current = noradId;
    }
    if (points.length >= 2) {
      lastPoints.current = points;
      writeLinePositions(line, points);
    }
  }, [line, noradId, points]);

  useFrame((_, delta) => {
    const material = line.material as LineMaterial;
    const showLine = points.length >= 2;
    material.opacity = THREE.MathUtils.damp(material.opacity, showLine ? LINE_OPACITY : 0, 8, delta);
    line.visible = material.opacity > 0.02;
    if (!showLine && material.opacity <= 0.02 && lastPoints.current.length) {
      disposeLineGeometry(line);
      lastPoints.current = [];
      line.visible = false;
    }
  });

  useEffect(() => {
    return () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    };
  }, [line]);

  return <primitive object={line} />;
}
