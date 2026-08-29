import { EARTH_RADIUS_KM, EARTH_RADIUS_SCENE } from "@/lib/orbit/constants";
import { degreesToRadians } from "@/lib/orbit/horizon";
import { displayRadiusFromAltitudeKm } from "@/lib/orbit/scale";

export interface SceneVec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Geodetic → Three.js Y-up, matching ECEF with Z-up remapped:
 *   scene.x = ECEF.x, scene.y = ECEF.z (north), scene.z = -ECEF.y
 * so (lat=0, lon=0) lies on +X and the north pole on +Y.
 */
export function writeGeodeticToScene(
  out: SceneVec3,
  latitudeDeg: number,
  longitudeDeg: number,
  radius: number,
): void {
  const lat = degreesToRadians(latitudeDeg);
  const lon = degreesToRadians(longitudeDeg);
  const cosLat = Math.cos(lat);
  out.x = radius * cosLat * Math.cos(lon);
  out.y = radius * Math.sin(lat);
  out.z = radius * -cosLat * Math.sin(lon);
}

export function geodeticToScene(
  latitudeDeg: number,
  longitudeDeg: number,
  radius: number,
): SceneVec3 {
  const out: SceneVec3 = { x: 0, y: 0, z: 0 };
  writeGeodeticToScene(out, latitudeDeg, longitudeDeg, radius);
  return out;
}

export function ecefKmToScene(
  ecef: { x: number; y: number; z: number },
  earthRadius = EARTH_RADIUS_SCENE,
): SceneVec3 {
  const scale = earthRadius / EARTH_RADIUS_KM;
  return {
    x: ecef.x * scale,
    y: ecef.z * scale,
    z: -ecef.y * scale,
  };
}

export function writeSatelliteScenePosition(
  out: SceneVec3,
  latitudeDeg: number,
  longitudeDeg: number,
  altitudeKm: number,
  earthRadius = EARTH_RADIUS_SCENE,
): void {
  writeGeodeticToScene(
    out,
    latitudeDeg,
    longitudeDeg,
    displayRadiusFromAltitudeKm(altitudeKm, earthRadius),
  );
}

export function satelliteScenePosition(
  latitudeDeg: number,
  longitudeDeg: number,
  altitudeKm: number,
  earthRadius = EARTH_RADIUS_SCENE,
): SceneVec3 {
  const out: SceneVec3 = { x: 0, y: 0, z: 0 };
  writeSatelliteScenePosition(out, latitudeDeg, longitudeDeg, altitudeKm, earthRadius);
  return out;
}
