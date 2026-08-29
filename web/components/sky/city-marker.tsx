"use client";

import type { City } from "@/lib/geo/cities";
import { EARTH_RADIUS_SCENE } from "@/lib/orbit/constants";
import { geodeticToScene } from "@/lib/orbit/coordinates";
import { useMemo } from "react";

export function CityMarker({ city }: { city: City }) {
  const position = useMemo(
    () =>
      geodeticToScene(
        city.latitudeDeg,
        city.longitudeDeg,
        EARTH_RADIUS_SCENE + 0.018,
      ),
    [city.latitudeDeg, city.longitudeDeg],
  );

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh>
        <sphereGeometry args={[0.026, 16, 16]} />
        <meshBasicMaterial color="#38bdf8" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.046, 16, 16]} />
        <meshBasicMaterial
          color="#38bdf8"
          opacity={0.22}
          transparent
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
