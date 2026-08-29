import {
  degreesLat,
  degreesLong,
  eciToEcf,
  eciToGeodetic,
  gstime,
  propagate,
} from "satellite.js";

import { writeSatelliteScenePosition, type SceneVec3 } from "@/lib/orbit/coordinates";
import { prepareSatrec } from "@/lib/orbit/propagate";
import type { SlimOmm } from "@/lib/orbit/types";

const sceneScratch: SceneVec3 = { x: 0, y: 0, z: 0 };

/** Close the ECEF loop when the period sample is within this of the start (km). */
const CLOSE_LOOP_KM = 0.001;

/** Vertices along the polyline, plus a wrap point so the ellipse closes. */
export const ORBIT_SEGMENTS = 128;

/** Re-sample TEME→ECEF on this cadence — never inside the globe render tick. */
export const ORBIT_REFRESH_MS = 10_000;

/** LEO fallback when MEAN_MOTION is missing or non-positive. */
const DEFAULT_PERIOD_MS = 90 * 60 * 1000;

export interface EcefKm {
  x: number;
  y: number;
  z: number;
}

export interface OrbitGeodeticPoint {
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm: number;
}

function periodMsFor(omm: SlimOmm): number {
  return omm.MEAN_MOTION > 0 ? 86_400_000 / omm.MEAN_MOTION : DEFAULT_PERIOD_MS;
}

function isFiniteEcef(point: { x: number; y: number; z: number }): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z) &&
    (point.x !== 0 || point.y !== 0 || point.z !== 0)
  );
}

function closeEcefLoop(points: EcefKm[]): EcefKm[] {
  if (points.length < 2) return [];
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const gapKm = Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z);
  if (gapKm > CLOSE_LOOP_KM) {
    points.push({ x: first.x, y: first.y, z: first.z });
  }
  return points;
}

/**
 * Sample one revolution in TEME, then convert every vertex with a **single**
 * GMST so the path is the instantaneous ECEF ellipse (same `eciToEcf` helper
 * as the catalog dots).
 *
 * These Cartesian km values are ECEF, not geodetic. Going through lat/lon
 * wraps at ±180° and splits a closed ellipse into disconnected segments.
 *
 * Using `gstime(sampleDate)` per tick would smear ~22° of Earth rotation
 * through the period and draw a ground-track scribble instead of a closed
 * LEO oval.
 */
export function sampleOrbitEcefKm(omm: SlimOmm, epochMs: number = Date.now()): EcefKm[] {
  const prepared = prepareSatrec(omm);
  if (!prepared) return [];

  const periodMs = periodMsFor(omm);
  const gmst = gstime(new Date(epochMs));
  const points: EcefKm[] = [];

  for (let i = 0; i <= ORBIT_SEGMENTS; i += 1) {
    const date = new Date(epochMs + (i / ORBIT_SEGMENTS) * periodMs);
    const pv = propagate(prepared.satrec, date);
    if (!pv?.position) continue;
    const ecef = eciToEcf(pv.position, gmst);
    if (!isFiniteEcef(ecef)) continue;
    points.push({ x: ecef.x, y: ecef.y, z: ecef.z });
  }

  return closeEcefLoop(points);
}

/**
 * Geodetic samples for leftover Three.js fixtures.
 */
export function sampleOrbitGeodeticPoints(
  omm: SlimOmm,
  epochMs: number = Date.now(),
  segments: number = ORBIT_SEGMENTS,
): OrbitGeodeticPoint[] {
  const prepared = prepareSatrec(omm);
  if (!prepared) return [];

  const count = Math.max(8, Math.floor(segments));
  const periodMs = periodMsFor(omm);
  const gmst = gstime(new Date(epochMs));
  const points: OrbitGeodeticPoint[] = [];

  for (let i = 0; i <= count; i += 1) {
    const date = new Date(epochMs + (i / count) * periodMs);
    const pv = propagate(prepared.satrec, date);
    if (!pv?.position) continue;
    const geo = eciToGeodetic(pv.position, gmst);
    const latitudeDeg = degreesLat(geo.latitude);
    const longitudeDeg = degreesLong(geo.longitude);
    const altitudeKm = geo.height;
    if (!Number.isFinite(latitudeDeg) || !Number.isFinite(longitudeDeg) || !Number.isFinite(altitudeKm)) {
      continue;
    }
    points.push({ latitudeDeg, longitudeDeg, altitudeKm });
  }

  return points.length >= 2 ? points : [];
}

/** Closed [lat, lon] ring for COBE arcs. Sample off the render thread. */
export function sampleOrbitCobeStations(
  omm: SlimOmm,
  epochMs: number = Date.now(),
  stations: number = 48,
): Array<[number, number]> {
  const points = sampleOrbitGeodeticPoints(omm, epochMs, stations);
  if (points.length < 2) return [];
  const ring: Array<[number, number]> = points.map((point) => [
    point.latitudeDeg,
    point.longitudeDeg,
  ]);
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

/** Three.js scene-space polyline (fixtures / leftover R3F helpers). */
export function sampleOrbitScenePoints(
  omm: SlimOmm,
  epochMs: number = Date.now(),
): Array<[number, number, number]> {
  const geodetic = sampleOrbitGeodeticPoints(omm, epochMs);
  const points: Array<[number, number, number]> = [];
  for (const point of geodetic) {
    writeSatelliteScenePosition(
      sceneScratch,
      point.latitudeDeg,
      point.longitudeDeg,
      point.altitudeKm,
    );
    points.push([sceneScratch.x, sceneScratch.y, sceneScratch.z]);
  }
  return points;
}
