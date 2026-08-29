import { PROPAGATE_PERIOD_MS } from "@/lib/orbit/constants";
import { displayRadiusFromAltitudeKm } from "@/lib/orbit/scale";
import type { VisibleSatellite } from "@/lib/orbit/types";

/** Packed layout for one visible satellite in the worker Float32Array. */
export const VISIBLE_FLOAT_STRIDE = 13;
export const VISIBLE_LAT = 0;
export const VISIBLE_LON = 1;
export const VISIBLE_ALT = 2;
export const VISIBLE_ELEV = 3;
export const VISIBLE_AZ = 4;
export const VISIBLE_RANGE = 5;
export const VISIBLE_SPEED = 6;
export const VISIBLE_VX = 7;
export const VISIBLE_VY = 8;
export const VISIBLE_VZ = 9;
export const VISIBLE_X = 10;
export const VISIBLE_Y = 11;
export const VISIBLE_Z = 12;

export interface VisibleWriteBuffers {
  floats: Float32Array;
  noradIds: Uint32Array;
  names: string[];
  objectIds: string[];
}

export interface OrbitSample {
  epochMs: number;
  arrivedAtMs: number;
  count: number;
  floats: Float32Array;
  noradIds: Uint32Array;
}

export interface OrbitSamplePair {
  prev: OrbitSample;
  curr: OrbitSample;
  /** norad catalog id → index in `prev` (rebuilt when a 1 Hz sample arrives). */
  prevIndexByNorad: Map<number, number>;
}

const emptySample = (): OrbitSample => ({
  epochMs: 0,
  arrivedAtMs: 0,
  count: 0,
  floats: new Float32Array(0),
  noradIds: new Uint32Array(0),
});

let samplePair: OrbitSamplePair = {
  prev: emptySample(),
  curr: emptySample(),
  prevIndexByNorad: new Map(),
};

export function createVisibleBuffers(capacity = 0): VisibleWriteBuffers {
  return {
    floats: new Float32Array(capacity * VISIBLE_FLOAT_STRIDE),
    noradIds: new Uint32Array(capacity),
    names: [],
    objectIds: [],
  };
}

export function ensureVisibleCapacity(buffers: VisibleWriteBuffers, maxSats: number): void {
  const needed = maxSats * VISIBLE_FLOAT_STRIDE;
  if (buffers.floats.length < needed) {
    buffers.floats = new Float32Array(needed);
    buffers.noradIds = new Uint32Array(maxSats);
  }
}

export function clamp01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path longitude lerp in degrees, result in (-180, 180]. */
export function lerpLongitudeDeg(a: number, b: number, t: number): number {
  let delta = b - a;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  let out = a + delta * t;
  if (out > 180) out -= 360;
  if (out <= -180) out += 360;
  return out;
}

/** Alpha along the 1 Hz sample interval. Clamped so we hold the latest sample if the next tick is late. */
export function sampleAlpha(elapsedMs: number, periodMs = PROPAGATE_PERIOD_MS): number {
  if (!(periodMs > 0)) return 1;
  return clamp01(elapsedMs / periodMs);
}

export function resetOrbitSamples(): void {
  samplePair = {
    prev: emptySample(),
    curr: emptySample(),
    prevIndexByNorad: new Map(),
  };
}

export function getOrbitSamplePair(): OrbitSamplePair {
  return samplePair;
}

/**
 * Keep the last two cloned worker buffers. The worker reuses its arrays;
 * `postMessage` structured-clone is sync, so these copies stay stable until
 * the next tick rotates them out.
 */
export function rotateOrbitSamples(incoming: {
  epochMs: number;
  count: number;
  floats: Float32Array;
  noradIds: Uint32Array;
  arrivedAtMs?: number;
}): OrbitSamplePair {
  const prevIndexByNorad = new Map<number, number>();
  const prev = samplePair.curr;
  for (let i = 0; i < prev.count; i += 1) {
    prevIndexByNorad.set(prev.noradIds[i]!, i);
  }
  samplePair = {
    prev,
    curr: {
      epochMs: incoming.epochMs,
      arrivedAtMs: incoming.arrivedAtMs ?? performance.now(),
      count: incoming.count,
      floats: incoming.floats,
      noradIds: incoming.noradIds,
    },
    prevIndexByNorad,
  };
  return samplePair;
}

export interface SceneScratch {
  x: number;
  y: number;
  z: number;
}

export interface GeodeticScratch {
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm: number;
}

/**
 * Lerp scene-space position for `currIndex` between the two 1 Hz samples.
 * New satellites (no previous match) snap to the current sample — never (0,0,0).
 * Horizon membership is whatever the worker already decided; we do not re-filter.
 */
export function lerpSampleScene(
  out: SceneScratch,
  pair: OrbitSamplePair,
  currIndex: number,
  t: number,
): void {
  const currBase = currIndex * VISIBLE_FLOAT_STRIDE;
  const currX = pair.curr.floats[currBase + VISIBLE_X]!;
  const currY = pair.curr.floats[currBase + VISIBLE_Y]!;
  const currZ = pair.curr.floats[currBase + VISIBLE_Z]!;
  const prevIndex = pair.prevIndexByNorad.get(pair.curr.noradIds[currIndex]!);
  if (prevIndex === undefined) {
    out.x = currX;
    out.y = currY;
    out.z = currZ;
    return;
  }
  const prevBase = prevIndex * VISIBLE_FLOAT_STRIDE;
  out.x = lerp(pair.prev.floats[prevBase + VISIBLE_X]!, currX, t);
  out.y = lerp(pair.prev.floats[prevBase + VISIBLE_Y]!, currY, t);
  out.z = lerp(pair.prev.floats[prevBase + VISIBLE_Z]!, currZ, t);
}

/**
 * Lerp lat/lon/alt for COBE markers. Same 1 Hz pair as the worker; never
 * re-runs SGP4. New sats snap to the current sample.
 */
export function lerpSampleGeodetic(
  out: GeodeticScratch,
  pair: OrbitSamplePair,
  currIndex: number,
  t: number,
): void {
  const currBase = currIndex * VISIBLE_FLOAT_STRIDE;
  const lat = pair.curr.floats[currBase + VISIBLE_LAT]!;
  const lon = pair.curr.floats[currBase + VISIBLE_LON]!;
  const alt = pair.curr.floats[currBase + VISIBLE_ALT]!;
  const prevIndex = pair.prevIndexByNorad.get(pair.curr.noradIds[currIndex]!);
  if (prevIndex === undefined) {
    out.latitudeDeg = lat;
    out.longitudeDeg = lon;
    out.altitudeKm = alt;
    return;
  }
  const prevBase = prevIndex * VISIBLE_FLOAT_STRIDE;
  out.latitudeDeg = lerp(pair.prev.floats[prevBase + VISIBLE_LAT]!, lat, t);
  out.longitudeDeg = lerpLongitudeDeg(pair.prev.floats[prevBase + VISIBLE_LON]!, lon, t);
  out.altitudeKm = lerp(pair.prev.floats[prevBase + VISIBLE_ALT]!, alt, t);
}

export function decodeVisibleSatellites(
  count: number,
  floats: Float32Array,
  noradIds: Uint32Array,
  names: string[],
  objectIds: string[],
): VisibleSatellite[] {
  const satellites: VisibleSatellite[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const base = i * VISIBLE_FLOAT_STRIDE;
    const vx = floats[base + VISIBLE_VX]!;
    const vy = floats[base + VISIBLE_VY]!;
    const vz = floats[base + VISIBLE_VZ]!;
    const altitudeKm = floats[base + VISIBLE_ALT]!;
    const noradId = String(noradIds[i]!);
    const satellite: VisibleSatellite = {
      noradId,
      name: names[i] ?? noradId,
      objectId: objectIds[i] ?? noradId,
      latitudeDeg: floats[base + VISIBLE_LAT]!,
      longitudeDeg: floats[base + VISIBLE_LON]!,
      altitudeKm,
      elevationDeg: floats[base + VISIBLE_ELEV]!,
      azimuthDeg: floats[base + VISIBLE_AZ]!,
      rangeKm: floats[base + VISIBLE_RANGE]!,
      speedKmS: floats[base + VISIBLE_SPEED]!,
      displayRadius: displayRadiusFromAltitudeKm(altitudeKm),
    };
    if (Number.isFinite(vx) && Number.isFinite(vy) && Number.isFinite(vz)) {
      satellite.velocity = { x: vx, y: vy, z: vz };
    }
    satellites[i] = satellite;
  }
  return satellites;
}
