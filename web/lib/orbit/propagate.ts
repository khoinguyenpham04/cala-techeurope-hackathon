import {
  degreesLat,
  degreesLong,
  ecfToLookAngles,
  eciToEcf,
  eciToGeodetic,
  gstime,
  json2satrec,
  propagate,
  SatRecError,
  type OMMJsonObject,
  type SatRec,
} from "satellite.js";

import { writeSatelliteScenePosition, type SceneVec3 } from "@/lib/orbit/coordinates";
import { degreesToRadians, isAboveHorizon, radiansToDegrees } from "@/lib/orbit/horizon";
import {
  decodeVisibleSatellites,
  ensureVisibleCapacity,
  VISIBLE_ALT,
  VISIBLE_AZ,
  VISIBLE_ELEV,
  VISIBLE_FLOAT_STRIDE,
  VISIBLE_LAT,
  VISIBLE_LON,
  VISIBLE_RANGE,
  VISIBLE_SPEED,
  VISIBLE_VX,
  VISIBLE_VY,
  VISIBLE_VZ,
  VISIBLE_X,
  VISIBLE_Y,
  VISIBLE_Z,
  type VisibleWriteBuffers,
} from "@/lib/orbit/sample-buffer";
import type { ObserverLocation, SlimOmm, VisibleSatellite } from "@/lib/orbit/types";

export interface PreparedSat {
  omm: SlimOmm;
  satrec: SatRec;
}

const sceneScratch: SceneVec3 = { x: 0, y: 0, z: 0 };

/** Slim catalog numbers → satellite.js `OMMJsonObject` (`OMMJsonObjectV3`). */
function toOmmJsonObject(omm: SlimOmm): OMMJsonObject {
  return {
    OBJECT_NAME: omm.OBJECT_NAME,
    OBJECT_ID: omm.OBJECT_ID,
    EPOCH: omm.EPOCH,
    MEAN_MOTION: omm.MEAN_MOTION,
    ECCENTRICITY: omm.ECCENTRICITY,
    INCLINATION: omm.INCLINATION,
    RA_OF_ASC_NODE: omm.RA_OF_ASC_NODE,
    ARG_OF_PERICENTER: omm.ARG_OF_PERICENTER,
    MEAN_ANOMALY: omm.MEAN_ANOMALY,
    NORAD_CAT_ID: omm.NORAD_CAT_ID,
    ELEMENT_SET_NO: omm.ELEMENT_SET_NO,
    BSTAR: omm.BSTAR,
    MEAN_MOTION_DOT: omm.MEAN_MOTION_DOT,
    MEAN_MOTION_DDOT: omm.MEAN_MOTION_DDOT,
  };
}

/** Once per catalog load. Skip records satellite.js cannot turn into a satrec. */
export function prepareSatrec(omm: SlimOmm): PreparedSat | null {
  try {
    const satrec = json2satrec(toOmmJsonObject(omm));
    if (satrec.error !== SatRecError.None) return null;
    return { omm, satrec };
  } catch {
    return null;
  }
}

export function observerGeodetic(observer: ObserverLocation) {
  return {
    latitude: degreesToRadians(observer.latitudeDeg),
    longitude: degreesToRadians(observer.longitudeDeg),
    height: observer.heightKm,
  };
}

function writeOne(
  prepared: PreparedSat,
  date: Date,
  observerGd: ReturnType<typeof observerGeodetic>,
  gmst: number,
  horizonOnly: boolean,
  out: VisibleWriteBuffers,
  slot: number,
): boolean {
  const pv = propagate(prepared.satrec, date);
  if (!pv || prepared.satrec.error !== SatRecError.None) return false;

  const geo = eciToGeodetic(pv.position, gmst);
  const ecf = eciToEcf(pv.position, gmst);
  const look = ecfToLookAngles(observerGd, ecf);
  const elevationDeg = radiansToDegrees(look.elevation);
  if (horizonOnly && !isAboveHorizon(elevationDeg)) return false;

  const velocity = pv.velocity;
  const hasVelocity = Boolean(velocity);
  const speedKmS = velocity
    ? Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z)
    : 0;

  const altitudeKm = geo.height;
  const latitudeDeg = degreesLat(geo.latitude);
  const longitudeDeg = degreesLong(geo.longitude);
  writeSatelliteScenePosition(sceneScratch, latitudeDeg, longitudeDeg, altitudeKm);

  const base = slot * VISIBLE_FLOAT_STRIDE;
  out.floats[base + VISIBLE_LAT] = latitudeDeg;
  out.floats[base + VISIBLE_LON] = longitudeDeg;
  out.floats[base + VISIBLE_ALT] = altitudeKm;
  out.floats[base + VISIBLE_ELEV] = elevationDeg;
  out.floats[base + VISIBLE_AZ] = radiansToDegrees(look.azimuth);
  out.floats[base + VISIBLE_RANGE] = look.rangeSat;
  out.floats[base + VISIBLE_SPEED] = speedKmS;
  out.floats[base + VISIBLE_VX] = hasVelocity ? velocity!.x : Number.NaN;
  out.floats[base + VISIBLE_VY] = hasVelocity ? velocity!.y : Number.NaN;
  out.floats[base + VISIBLE_VZ] = hasVelocity ? velocity!.z : Number.NaN;
  out.floats[base + VISIBLE_X] = sceneScratch.x;
  out.floats[base + VISIBLE_Y] = sceneScratch.y;
  out.floats[base + VISIBLE_Z] = sceneScratch.z;
  out.noradIds[slot] = prepared.omm.NORAD_CAT_ID >>> 0;
  out.names[slot] = prepared.omm.OBJECT_NAME;
  out.objectIds[slot] = prepared.omm.OBJECT_ID;
  return true;
}

export function propagateOne(
  prepared: PreparedSat,
  date: Date,
  observer: ObserverLocation,
  options: { horizonOnly?: boolean } = {},
): VisibleSatellite | null {
  const buffers: VisibleWriteBuffers = {
    floats: new Float32Array(VISIBLE_FLOAT_STRIDE),
    noradIds: new Uint32Array(1),
    names: [],
    objectIds: [],
  };
  const ok = writeOne(
    prepared,
    date,
    observerGeodetic(observer),
    gstime(date),
    options.horizonOnly ?? true,
    buffers,
    0,
  );
  if (!ok) return null;
  buffers.names.length = 1;
  buffers.objectIds.length = 1;
  return decodeVisibleSatellites(1, buffers.floats, buffers.noradIds, buffers.names, buffers.objectIds)[0] ?? null;
}

/**
 * Worker tick: SGP4 + horizon into reusable typed arrays.
 * `gmst` / observer geodetic are computed once per call, not per satellite.
 */
export function propagateVisibleInto(
  catalog: PreparedSat[],
  date: Date,
  observer: ObserverLocation,
  options: { horizonOnly?: boolean },
  out: VisibleWriteBuffers,
): number {
  ensureVisibleCapacity(out, catalog.length);
  const gmst = gstime(date);
  const observerGd = observerGeodetic(observer);
  const horizonOnly = options.horizonOnly ?? true;
  let count = 0;
  for (const prepared of catalog) {
    if (writeOne(prepared, date, observerGd, gmst, horizonOnly, out, count)) {
      count += 1;
    }
  }
  out.names.length = count;
  out.objectIds.length = count;
  return count;
}

export function propagateVisible(
  catalog: PreparedSat[],
  date: Date,
  observer: ObserverLocation,
  options: { horizonOnly?: boolean } = {},
): VisibleSatellite[] {
  const out = {
    floats: new Float32Array(catalog.length * VISIBLE_FLOAT_STRIDE),
    noradIds: new Uint32Array(catalog.length),
    names: [] as string[],
    objectIds: [] as string[],
  };
  const count = propagateVisibleInto(catalog, date, observer, options, out);
  return decodeVisibleSatellites(count, out.floats, out.noradIds, out.names, out.objectIds);
}
