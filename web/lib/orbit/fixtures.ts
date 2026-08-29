import { EARTH_RADIUS_SCENE } from "@/lib/orbit/constants";
import { geodeticToScene, satelliteScenePosition } from "@/lib/orbit/coordinates";
import { isAboveHorizon } from "@/lib/orbit/horizon";
import { parseOmmRecord } from "@/lib/orbit/omm";
import { ORBIT_SEGMENTS, sampleOrbitScenePoints } from "@/lib/orbit/orbit-path";
import { prepareSatrec, propagateVisible } from "@/lib/orbit/propagate";
import {
  lerp,
  lerpLongitudeDeg,
  lerpSampleScene,
  resetOrbitSamples,
  rotateOrbitSamples,
  sampleAlpha,
  VISIBLE_FLOAT_STRIDE,
  VISIBLE_X,
  VISIBLE_Y,
  VISIBLE_Z,
} from "@/lib/orbit/sample-buffer";
import { compressedAltitudeOffset } from "@/lib/orbit/scale";
import type { SlimOmm } from "@/lib/orbit/types";

/** Fixed clock for deterministic propagation tests. */
export const FIXTURE_CLOCK = new Date("2026-08-29T12:00:00.000Z");

export const VALID_OMM: SlimOmm = {
  OBJECT_NAME: "ISS (ZARYA)",
  OBJECT_ID: "1998-067A",
  EPOCH: "2026-08-29T00:00:00.000000",
  MEAN_MOTION: 15.5,
  ECCENTRICITY: 0.0003,
  INCLINATION: 51.64,
  RA_OF_ASC_NODE: 20.1,
  ARG_OF_PERICENTER: 80.2,
  MEAN_ANOMALY: 280.0,
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  BSTAR: 0.0001,
  MEAN_MOTION_DOT: 0.00005,
  MEAN_MOTION_DDOT: 0,
};

const SIX_DIGIT_OMM: SlimOmm = {
  ...VALID_OMM,
  OBJECT_NAME: "STARLINK-99999",
  OBJECT_ID: "2024-000A",
  NORAD_CAT_ID: 100000,
};

function approxEqual(actual: number, expected: number, epsilon = 1e-9): boolean {
  return Math.abs(actual - expected) <= epsilon;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * Deterministic fixtures for horizon filtering, coordinate conversion,
 * invalid records, and a fixed clock. Throws if any assertion fails.
 */
export function verifyOrbitFixtures(): void {
  assert(isAboveHorizon(0.01) === true, "elevation just above 0° must count as visible");
  assert(isAboveHorizon(0) === false, "elevation exactly 0° is on the horizon, not above");
  assert(isAboveHorizon(-1) === false, "negative elevation is below the horizon");
  assert(isAboveHorizon(Number.NaN) === false, "NaN elevation is not visible");

  const equator = geodeticToScene(0, 0, 1);
  assert(approxEqual(equator.x, 1) && approxEqual(equator.y, 0) && approxEqual(equator.z, 0), "lat0 lon0 should sit on +X");
  const north = geodeticToScene(90, 0, 1);
  assert(approxEqual(north.x, 0, 1e-9) && approxEqual(north.y, 1) && approxEqual(north.z, 0, 1e-9), "north pole should sit on +Y");
  const east = geodeticToScene(0, 90, 1);
  assert(approxEqual(east.x, 0, 1e-9) && approxEqual(east.y, 0, 1e-9) && approxEqual(east.z, -1), "lon 90°E should sit on -Z");

  assert(parseOmmRecord(VALID_OMM)?.NORAD_CAT_ID === 25544, "valid OMM must parse");
  assert(parseOmmRecord(SIX_DIGIT_OMM)?.NORAD_CAT_ID === 100000, "six-digit NORAD IDs must parse");
  assert(parseOmmRecord({}) === null, "empty object is invalid");
  assert(parseOmmRecord({ ...VALID_OMM, EPOCH: "" }) === null, "missing epoch is invalid");
  assert(parseOmmRecord({ ...VALID_OMM, NORAD_CAT_ID: "abc" }) === null, "non-numeric NORAD is invalid");
  assert(parseOmmRecord({ ...VALID_OMM, NORAD_CAT_ID: 12.5 }) === null, "non-integer NORAD is invalid");
  assert(
    parseOmmRecord({ ...VALID_OMM, NORAD_CAT_ID: "0025544" })?.NORAD_CAT_ID === 25544,
    "string NORAD values must coerce",
  );

  assert(FIXTURE_CLOCK.toISOString() === "2026-08-29T12:00:00.000Z", "fixture clock is the hackathon Saturday noon UTC");
  assert(FIXTURE_CLOCK.getTime() === Date.parse("2026-08-29T12:00:00.000Z"), "fixed clock is stable across Date.parse");

  assert(approxEqual(compressedAltitudeOffset(0), 0.05), "surface offset");
  assert(approxEqual(compressedAltitudeOffset(2000), 0.32), "LEO band end");
  assert(compressedAltitudeOffset(35786) > compressedAltitudeOffset(20000), "GEO sits above MEO visually");
  assert(compressedAltitudeOffset(35786) < 0.6, "GEO stays inside the compressed envelope");

  const issPath = sampleOrbitScenePoints(VALID_OMM, FIXTURE_CLOCK.getTime());
  assert(issPath.length === ORBIT_SEGMENTS + 1, "ISS path is one closed polyline (N segments + wrap)");
  const radii = issPath.map((p) => Math.hypot(p[0], p[1], p[2]));
  const minR = Math.min(...radii);
  const maxR = Math.max(...radii);
  assert(minR > EARTH_RADIUS_SCENE, "ISS ellipse stays above the Earth surface");
  assert(maxR - minR < 0.08, "ISS is near-circular LEO after compressed altitude mapping");
  const first = issPath[0]!;
  const last = issPath[issPath.length - 1]!;
  assert(
    Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2]) < 0.04,
    "ISS path closes on itself (frozen GMST, not a ground-track scribble)",
  );

  assert(approxEqual(lerp(0, 10, 0), 0), "lerp at t=0 is the start sample");
  assert(approxEqual(lerp(0, 10, 1), 10), "lerp at t=1 is the end sample");
  assert(approxEqual(lerp(0, 10, 0.5), 5), "lerp at t=0.5 is the midpoint");
  assert(approxEqual(lerpLongitudeDeg(170, -170, 0.5), 180), "longitude lerp takes the antimeridian short path");
  assert(sampleAlpha(0, 1000) === 0, "sample alpha starts at 0 when the 1 Hz tick just arrived");
  assert(sampleAlpha(1000, 1000) === 1, "sample alpha reaches 1 at the next SGP4 period");
  assert(sampleAlpha(2500, 1000) === 1, "sample alpha holds at 1 if the next tick is late");

  const prevFloats = new Float32Array(VISIBLE_FLOAT_STRIDE);
  const currFloats = new Float32Array(VISIBLE_FLOAT_STRIDE);
  prevFloats[VISIBLE_X] = 0;
  prevFloats[VISIBLE_Y] = 0;
  prevFloats[VISIBLE_Z] = 0;
  currFloats[VISIBLE_X] = 10;
  currFloats[VISIBLE_Y] = 4;
  currFloats[VISIBLE_Z] = -2;
  resetOrbitSamples();
  rotateOrbitSamples({
    epochMs: 1,
    count: 1,
    floats: prevFloats,
    noradIds: new Uint32Array([25544]),
    arrivedAtMs: 0,
  });
  const pair = rotateOrbitSamples({
    epochMs: 2,
    count: 1,
    floats: currFloats,
    noradIds: new Uint32Array([25544]),
    arrivedAtMs: 1000,
  });
  const mid = { x: 0, y: 0, z: 0 };
  lerpSampleScene(mid, pair, 0, 0.5);
  assert(approxEqual(mid.x, 5) && approxEqual(mid.y, 2) && approxEqual(mid.z, -1), "matched sats lerp scene xyz between 1 Hz samples");
  lerpSampleScene(mid, pair, 0, 0);
  assert(approxEqual(mid.x, 0) && approxEqual(mid.y, 0) && approxEqual(mid.z, 0), "t=0 is the previous sample");

  const appearing = rotateOrbitSamples({
    epochMs: 3,
    count: 1,
    floats: currFloats,
    noradIds: new Uint32Array([99999]),
    arrivedAtMs: 2000,
  });
  lerpSampleScene(mid, appearing, 0, 0);
  assert(
    approxEqual(mid.x, 10) && approxEqual(mid.y, 4) && approxEqual(mid.z, -2),
    "a newly visible sat snaps to the current sample, not the origin",
  );
  resetOrbitSamples();

  const barcelona = { latitudeDeg: 41.3874, longitudeDeg: 2.1686, heightKm: 0.012 };
  const prepared = prepareSatrec(VALID_OMM);
  assert(prepared !== null, "valid ISS OMM must json2satrec once and reuse");
  if (!prepared) return;
  const reused = prepareSatrec(VALID_OMM);
  assert(reused !== null && reused.satrec !== prepared.satrec, "each prepareSatrec builds a satrec; the worker caches the result, not this helper");
  assert(prepareSatrec({ ...VALID_OMM, ECCENTRICITY: 1.5 }) === null, "invalid OMM is skipped at satrec prepare");

  const unfiltered = propagateVisible([prepared], FIXTURE_CLOCK, barcelona, { horizonOnly: false });
  assert(unfiltered.length === 1, "fixed-clock ISS must propagate without a horizon filter");
  assert(unfiltered[0]!.latitudeDeg !== undefined && unfiltered[0]!.longitudeDeg !== undefined, "VisibleSatellite exposes lat/lon");
  assert(unfiltered[0]!.altitudeKm > 0, "VisibleSatellite exposes altitude");
  assert(unfiltered[0]!.velocity !== undefined, "VisibleSatellite exposes ECI velocity when present");
  const issNow = satelliteScenePosition(
    unfiltered[0]!.latitudeDeg,
    unfiltered[0]!.longitudeDeg,
    unfiltered[0]!.altitudeKm,
  );
  assert(
    Math.hypot(issPath[0]![0] - issNow.x, issPath[0]![1] - issNow.y, issPath[0]![2] - issNow.z) < 1e-6,
    "ISS current ECEF position sits on the orbit polyline",
  );
  const filtered = propagateVisible([prepared], FIXTURE_CLOCK, barcelona, { horizonOnly: true });
  assert(
    filtered.length === (isAboveHorizon(unfiltered[0]!.elevationDeg) ? 1 : 0),
    "horizon filter is applied at propagate time, not later on rAF",
  );
}
