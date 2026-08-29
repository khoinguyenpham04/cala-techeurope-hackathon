import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
} from "satellite.js";

import { writeSatelliteScenePosition, type SceneVec3 } from "@/lib/orbit/coordinates";
import { prepareSatrec } from "@/lib/orbit/propagate";
import type { SlimOmm } from "@/lib/orbit/types";

const sceneScratch: SceneVec3 = { x: 0, y: 0, z: 0 };

/** Vertices along the polyline, plus a wrap point so the ellipse closes. */
export const ORBIT_SEGMENTS = 128;

/** Re-sample TEME→ECEF on this cadence — never inside rAF. */
export const ORBIT_REFRESH_MS = 10_000;

/** LEO fallback when MEAN_MOTION is missing or non-positive. */
const DEFAULT_PERIOD_MS = 90 * 60 * 1000;

/**
 * Sample one revolution in TEME, then convert every vertex with a **single**
 * GMST so the path is the instantaneous ECEF ellipse (same frame as the dots).
 *
 * Using `gstime(sampleDate)` per tick would smear ~22° of Earth rotation
 * through the period and draw a ground-track scribble instead of a closed
 * LEO oval.
 */
export function sampleOrbitScenePoints(
  omm: SlimOmm,
  epochMs: number = Date.now(),
): Array<[number, number, number]> {
  const prepared = prepareSatrec(omm);
  if (!prepared) return [];

  const periodMs = omm.MEAN_MOTION > 0 ? 86_400_000 / omm.MEAN_MOTION : DEFAULT_PERIOD_MS;
  const gmst = gstime(new Date(epochMs));
  const points: Array<[number, number, number]> = [];

  for (let i = 0; i <= ORBIT_SEGMENTS; i += 1) {
    const date = new Date(epochMs + (i / ORBIT_SEGMENTS) * periodMs);
    const pv = propagate(prepared.satrec, date);
    if (!pv?.position) continue;
    // One GMST for every TEME sample = ECEF ellipse at `epochMs` (not a ground track).
    const geo = eciToGeodetic(pv.position, gmst);
    writeSatelliteScenePosition(
      sceneScratch,
      degreesLat(geo.latitude),
      degreesLong(geo.longitude),
      geo.height,
    );
    points.push([sceneScratch.x, sceneScratch.y, sceneScratch.z]);
  }

  return points.length >= 2 ? points : [];
}
