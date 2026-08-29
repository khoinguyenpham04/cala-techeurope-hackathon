/** Mean Earth radius (km) used for geodetic height → scene scale. */
export const EARTH_RADIUS_KM = 6371;

/** Earth radius in Three.js scene units. */
export const EARTH_RADIUS_SCENE = 1.6;

/** Axial tilt applied to the ECEF group for a cinematic globe. */
export const EARTH_TILT_DEG = 23.4;

/** Observer elevation strictly greater than this (degrees) counts as above-horizon. */
export const HORIZON_ELEVATION_DEG = 0;

/** Successful CelesTrak downloads are reused for this long. */
export const CATALOG_TTL_MS = 2 * 60 * 60 * 1000;

/** After a non-200 CelesTrak response, do not retry until this elapses. */
export const CELESTRAK_BLOCK_MS = CATALOG_TTL_MS;

/** Short backoff after a network/timeout failure so we do not hammer the endpoint. */
export const CELESTRAK_TRANSIENT_BACKOFF_MS = 60_000;

export const CELESTRAK_ACTIVE_OMM_URL =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=JSON";

export const PROPAGATE_HZ = 1;

/** Default instance-color for payloads with no Cala owner color yet. */
export const UNKNOWN_OWNER_COLOR = "#94a3b8";

export const DEFAULT_CITY_ID = "barcelona";
