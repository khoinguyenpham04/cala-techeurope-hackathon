"use client";

import { CityMarker } from "@/components/sky/city-marker";
import { OrbitPath } from "@/components/sky/orbit-path";
import { SatelliteLayer } from "@/components/sky/satellite-layer";
import type { City } from "@/lib/geo/cities";
import {
  EARTH_RADIUS_SCENE,
  EARTH_TILT_DEG,
} from "@/lib/orbit/constants";
import { geodeticToScene } from "@/lib/orbit/coordinates";
import type { SatelliteOverlayMap, SlimOmm, VisibleSatellite } from "@/lib/orbit/types";
import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Drop NASA Blue Marble Next Generation (equirectangular JPEG) here:
 * https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg
 * Page: https://visibleearth.nasa.gov/images/73909/december-blue-marble-next-generation
 * File: `web/public/earth/blue-marble.jpg` → URL `/earth/blue-marble.jpg`.
 * Missing file keeps the procedural Earth; we do not retry after a failed load.
 */
const BLUE_MARBLE_URL = "/earth/blue-marble.jpg";

let blueMarbleFailed = false;

function makeGraticuleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 24; i += 1) {
    const x = (i / 24) * canvas.width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let j = 0; j <= 12; j += 1) {
    const y = (j / 12) * canvas.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function Earth() {
  const gl = useThree((state) => state.gl);
  const [marble, setMarble] = useState<THREE.Texture | null>(null);
  const grid = useMemo(() => makeGraticuleTexture(), []);

  useEffect(() => {
    if (blueMarbleFailed) return;
    let cancelled = false;
    let loaded: THREE.Texture | null = null;

    const loader = new THREE.TextureLoader();
    loader.load(
      BLUE_MARBLE_URL,
      (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
        loaded = texture;
        setMarble(texture);
      },
      undefined,
      () => {
        blueMarbleFailed = true;
      },
    );

    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [gl]);

  useEffect(() => {
    if (marble) grid.dispose();
  }, [grid, marble]);

  useEffect(() => () => grid.dispose(), [grid]);

  const photo = marble != null;

  return (
    <group>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS_SCENE, 96, 64]} />
        <meshStandardMaterial
          color={photo ? "#ffffff" : "#c5d4e8"}
          emissive={photo ? "#000000" : "#0b1220"}
          emissiveIntensity={photo ? 0 : 0.4}
          map={marble ?? grid}
          metalness={0.04}
          roughness={photo ? 0.82 : 0.92}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS_SCENE * 1.028, 48, 32]} />
        <meshBasicMaterial
          color={photo ? "#6ea8ff" : "#5b8def"}
          opacity={photo ? 0.1 : 0.14}
          side={THREE.BackSide}
          transparent
        />
      </mesh>
    </group>
  );
}

function applyTilt(point: THREE.Vector3, tiltRad: number) {
  point.applyAxisAngle(new THREE.Vector3(1, 0, 0), tiltRad);
  return point;
}

function cityCameraPosition(city: City) {
  const surface = geodeticToScene(
    city.latitudeDeg,
    city.longitudeDeg,
    EARTH_RADIUS_SCENE * 3.15,
  );
  const dest = applyTilt(
    new THREE.Vector3(surface.x, surface.y, surface.z),
    THREE.MathUtils.degToRad(EARTH_TILT_DEG),
  );
  dest.y += 0.35;
  return dest;
}

function CameraRig({ city }: { city: City }) {
  const { camera } = useThree();
  const dest = useRef(new THREE.Vector3());
  const animating = useRef(true);

  useEffect(() => {
    dest.current.copy(cityCameraPosition(city));
    animating.current = true;
  }, [city]);

  useFrame(() => {
    if (!animating.current) return;
    camera.position.lerp(dest.current, 0.1);
    camera.lookAt(0, 0, 0);
    if (camera.position.distanceTo(dest.current) < 0.03) {
      animating.current = false;
    }
  });

  return null;
}

function GlobeContents({
  city,
  visible,
  overlay,
  selectedNoradId,
  selectedOmm,
  onSelect,
}: {
  city: City;
  visible: VisibleSatellite[];
  overlay: SatelliteOverlayMap;
  selectedNoradId: string | null;
  selectedOmm: SlimOmm | null;
  onSelect: (noradId: string | null) => void;
}) {
  const tilt = THREE.MathUtils.degToRad(EARTH_TILT_DEG);

  return (
    <>
      <color args={["#000000"]} attach="background" />
      <ambientLight intensity={0.55} />
      <directionalLight intensity={2.1} position={[6, 3.2, 4]} />
      <directionalLight color="#93c5fd" intensity={0.18} position={[-5, -2, -3]} />
      <Stars count={1400} depth={40} factor={1.8} fade radius={60} speed={0.15} />
      <group rotation={[tilt, 0, 0]}>
        <Earth />
        <CityMarker city={city} />
        <OrbitPath omm={selectedOmm} />
        <SatelliteLayer
          onSelect={onSelect}
          overlay={overlay}
          selectedNoradId={selectedNoradId}
          visible={visible}
        />
      </group>
      <CameraRig city={city} />
      <OrbitControls
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
        maxDistance={8.5}
        minDistance={2.45}
      />
    </>
  );
}

export function GlobeScene({
  city,
  visible,
  overlay,
  selectedNoradId,
  selectedOmm = null,
  onSelect,
}: {
  city: City;
  visible: VisibleSatellite[];
  overlay: SatelliteOverlayMap;
  selectedNoradId: string | null;
  selectedOmm?: SlimOmm | null;
  onSelect: (noradId: string | null) => void;
}) {
  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    return () => {
      glRef.current?.dispose();
      glRef.current?.forceContextLoss();
      glRef.current = null;
    };
  }, []);

  return (
    <Canvas
      camera={{ fov: 42, near: 0.1, far: 80, position: [0, 1.1, 4.4] }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        glRef.current = gl;
        gl.setClearColor("#000000");
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }}
      onPointerMissed={() => onSelect(null)}
    >
      <GlobeContents
        city={city}
        onSelect={onSelect}
        overlay={overlay}
        selectedNoradId={selectedNoradId}
        selectedOmm={selectedOmm}
        visible={visible}
      />
    </Canvas>
  );
}
