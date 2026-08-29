import type { SlimOmm } from "@/lib/orbit/types";

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validate one CelesTrak OMM object into the slim contract `json2satrec` accepts.
 * Invalid / incomplete records return null (they are dropped, not inferred).
 */
export function parseOmmRecord(raw: unknown): SlimOmm | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  const name = asNonEmptyString(row.OBJECT_NAME);
  const objectId = asNonEmptyString(row.OBJECT_ID);
  const epoch = asNonEmptyString(row.EPOCH);
  const norad = asFiniteNumber(row.NORAD_CAT_ID);
  const meanMotion = asFiniteNumber(row.MEAN_MOTION);
  const eccentricity = asFiniteNumber(row.ECCENTRICITY);
  const inclination = asFiniteNumber(row.INCLINATION);
  const raan = asFiniteNumber(row.RA_OF_ASC_NODE);
  const argp = asFiniteNumber(row.ARG_OF_PERICENTER);
  const meanAnomaly = asFiniteNumber(row.MEAN_ANOMALY);

  if (
    !name ||
    !objectId ||
    !epoch ||
    norad === null ||
    norad <= 0 ||
    !Number.isInteger(norad) ||
    meanMotion === null ||
    eccentricity === null ||
    inclination === null ||
    raan === null ||
    argp === null ||
    meanAnomaly === null
  ) {
    return null;
  }

  return {
    OBJECT_NAME: name,
    OBJECT_ID: objectId,
    EPOCH: epoch,
    MEAN_MOTION: meanMotion,
    ECCENTRICITY: eccentricity,
    INCLINATION: inclination,
    RA_OF_ASC_NODE: raan,
    ARG_OF_PERICENTER: argp,
    MEAN_ANOMALY: meanAnomaly,
    NORAD_CAT_ID: norad,
    ELEMENT_SET_NO: asFiniteNumber(row.ELEMENT_SET_NO) ?? 999,
    BSTAR: asFiniteNumber(row.BSTAR) ?? 0,
    MEAN_MOTION_DOT: asFiniteNumber(row.MEAN_MOTION_DOT) ?? 0,
    MEAN_MOTION_DDOT: asFiniteNumber(row.MEAN_MOTION_DDOT) ?? 0,
  };
}

export function parseOmmCatalog(payload: unknown): {
  records: SlimOmm[];
  dropped: number;
} {
  if (!Array.isArray(payload)) {
    return { records: [], dropped: 0 };
  }
  const records: SlimOmm[] = [];
  let dropped = 0;
  for (const item of payload) {
    const parsed = parseOmmRecord(item);
    if (parsed) records.push(parsed);
    else dropped += 1;
  }
  return { records, dropped };
}

export function noradKey(noradCatId: number | string): string {
  return String(noradCatId).replace(/^0+/, "") || "0";
}
