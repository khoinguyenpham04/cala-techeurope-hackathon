import type { CSSProperties } from "react";

export const CITY_MARKER_ID = "city";
export const LOOK_ARC_ID = "look";

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/**
 * COBE draws a quadratic Bezier on the short (from+to) chord. Nearby city/sat
 * pairs therefore collapse to a local hop. Station the long-way great circle
 * every ~72° so each Bezier stays well-defined and the chain wraps the globe.
 */
const LOOK_WRAP_STEP_RAD = 72 * DEG;
const LOOK_WRAP_MIN_SEGMENTS = 2;
const COLINEAR_EPS = 1e-6;

type Vec3 = [number, number, number];

function latLonToVec(latDeg: number, lonDeg: number): Vec3 {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), Math.sin(lat), cosLat * Math.sin(lon)];
}

function vecToLatLon(vec: Vec3): [number, number] {
  const length = Math.hypot(vec[0], vec[1], vec[2]) || 1;
  const y = vec[1] / length;
  return [
    Math.asin(Math.max(-1, Math.min(1, y))) * RAD,
    Math.atan2(vec[2] / length, vec[0] / length) * RAD,
  ];
}

function wrapAxis(from: Vec3, to: Vec3): Vec3 {
  const axis: Vec3 = [
    from[1] * to[2] - from[2] * to[1],
    from[2] * to[0] - from[0] * to[2],
    from[0] * to[1] - from[1] * to[0],
  ];
  const mag = Math.hypot(axis[0], axis[1], axis[2]);
  if (mag > COLINEAR_EPS) {
    return [axis[0] / mag, axis[1] / mag, axis[2] / mag];
  }
  const hint: Vec3 = Math.abs(from[1]) < 0.97 ? [0, 1, 0] : [1, 0, 0];
  const east: Vec3 = [
    hint[1] * from[2] - hint[2] * from[1],
    hint[2] * from[0] - hint[0] * from[2],
    hint[0] * from[1] - hint[1] * from[0],
  ];
  const eastMag = Math.hypot(east[0], east[1], east[2]) || 1;
  return [east[0] / eastMag, east[1] / eastMag, east[2] / eastMag];
}

function rotateAround(vec: Vec3, axis: Vec3, angle: number): Vec3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dot = axis[0] * vec[0] + axis[1] * vec[1] + axis[2] * vec[2];
  const oneMinus = 1 - cos;
  return [
    vec[0] * cos + (axis[1] * vec[2] - axis[2] * vec[1]) * sin + axis[0] * dot * oneMinus,
    vec[1] * cos + (axis[2] * vec[0] - axis[0] * vec[2]) * sin + axis[1] * dot * oneMinus,
    vec[2] * cos + (axis[0] * vec[1] - axis[1] * vec[0]) * sin + axis[2] * dot * oneMinus,
  ];
}

/**
 * Lat/lon stations for a long-way great-circle wrap (city → far side → sat).
 * COBE only ever draws the short chord, so the look path is a chain of these.
 */
export function lookArcStations(
  fromLatDeg: number,
  fromLonDeg: number,
  toLatDeg: number,
  toLonDeg: number,
): Array<[number, number]> {
  const from = latLonToVec(fromLatDeg, fromLonDeg);
  const to = latLonToVec(toLatDeg, toLonDeg);
  const dot = Math.max(-1, Math.min(1, from[0] * to[0] + from[1] * to[1] + from[2] * to[2]));
  const shortAngle = Math.acos(dot);
  const longAngle = Math.PI * 2 - shortAngle;
  const axis = wrapAxis(from, to);
  const segments = Math.max(LOOK_WRAP_MIN_SEGMENTS, Math.ceil(longAngle / LOOK_WRAP_STEP_RAD));
  const stations: Array<[number, number]> = [[fromLatDeg, fromLonDeg]];
  for (let index = 1; index < segments; index += 1) {
    stations.push(vecToLatLon(rotateAround(from, axis, (-index / segments) * longAngle)));
  }
  stations.push([toLatDeg, toLonDeg]);
  return stations;
}

/** shuding's lat/lon → COBE `phi`/`theta` so a city sits facing the camera. */
export function locationToAngles(latDeg: number, lonDeg: number): { phi: number; theta: number } {
  return {
    phi: Math.PI - ((lonDeg * Math.PI) / 180 - Math.PI / 2),
    theta: (latDeg * Math.PI) / 180,
  };
}

export function lerpAngle(from: number, to: number, t: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

export function markerIdForNorad(noradId: string): string {
  return `sat-${noradId}`;
}

/**
 * COBE sets `--cobe-visible-{id}` only while the marker faces the camera, and
 * the value is invalid CSS — browsers drop it so opacity/filter use defaults.
 * When hidden the var is undefined and these fallbacks apply (opacity 0, blur).
 */
export function cobeMarkerStyle(id: string): CSSProperties {
  return {
    positionAnchor: `--cobe-${id}`,
    opacity: `var(--cobe-visible-${id}, 0)`,
    filter: `blur(var(--cobe-visible-${id}, 8px))`,
  };
}

/** Same visibility trick, anchored at the arc peak (`--cobe-arc-{id}`). */
export function cobeArcStyle(id: string): CSSProperties {
  return {
    positionAnchor: `--cobe-arc-${id}`,
    opacity: `var(--cobe-visible-arc-${id}, 0)`,
    filter: `blur(var(--cobe-visible-arc-${id}, 8px))`,
  };
}
