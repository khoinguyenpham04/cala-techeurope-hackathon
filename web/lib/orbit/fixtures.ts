import { geodeticToScene } from "@/lib/orbit/coordinates";
import { isAboveHorizon } from "@/lib/orbit/horizon";
import { parseOmmRecord } from "@/lib/orbit/omm";
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

function assert(condition: boolean, message: string) {
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
}
