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

import { degreesToRadians, isAboveHorizon, radiansToDegrees } from "@/lib/orbit/horizon";
import { noradKey } from "@/lib/orbit/omm";
import { displayRadiusFromAltitudeKm } from "@/lib/orbit/scale";
import type { ObserverLocation, SlimOmm, VisibleSatellite } from "@/lib/orbit/types";

export interface PreparedSat {
  omm: SlimOmm;
  satrec: SatRec;
}

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

export function propagateOne(
  prepared: PreparedSat,
  date: Date,
  observer: ObserverLocation,
): VisibleSatellite | null {
  const pv = propagate(prepared.satrec, date);
  if (!pv || prepared.satrec.error !== SatRecError.None) return null;

  const gmst = gstime(date);
  const geo = eciToGeodetic(pv.position, gmst);
  const ecf = eciToEcf(pv.position, gmst);
  const look = ecfToLookAngles(observerGeodetic(observer), ecf);
  const elevationDeg = radiansToDegrees(look.elevation);
  if (!isAboveHorizon(elevationDeg)) return null;

  const altitudeKm = geo.height;
  return {
    noradId: noradKey(prepared.omm.NORAD_CAT_ID),
    name: prepared.omm.OBJECT_NAME,
    objectId: prepared.omm.OBJECT_ID,
    latitudeDeg: degreesLat(geo.latitude),
    longitudeDeg: degreesLong(geo.longitude),
    altitudeKm,
    elevationDeg,
    azimuthDeg: radiansToDegrees(look.azimuth),
    rangeKm: look.rangeSat,
    displayRadius: displayRadiusFromAltitudeKm(altitudeKm),
  };
}

export function propagateVisible(
  catalog: PreparedSat[],
  date: Date,
  observer: ObserverLocation,
): VisibleSatellite[] {
  const visible: VisibleSatellite[] = [];
  for (const prepared of catalog) {
    const sat = propagateOne(prepared, date, observer);
    if (sat) visible.push(sat);
  }
  return visible;
}
