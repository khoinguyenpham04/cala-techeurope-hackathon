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

/** HUD copy when serving a disk snapshot after a policy/non-200 block. */
export const CELESTRAK_STALE_MESSAGE =
  "Using cached catalog; CelesTrak blocked this refresh.";

/** InstancedMesh capacity — one mesh, not 40k Mesh objects. */
export const MAX_SATELLITE_INSTANCES = 48_000;

/** Short backoff after a network/timeout failure so we do not hammer the endpoint. */
export const CELESTRAK_TRANSIENT_BACKOFF_MS = 60_000;

export const CELESTRAK_ACTIVE_OMM_URL =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=JSON";

/**
 * Two clocks, do not mix them:
 * - SGP4 clock (`PROPAGATE_HZ`, 1 Hz) lives in the orbit worker. `json2satrec`
 *   runs once per catalog load; `propagate` + horizon filter run only on this
 *   tick. Never call SGP4 / `json2satrec` inside `useFrame`.
 * - Render clock (rAF) only interpolates the latest two 1 Hz samples onto
 *   InstancedMesh matrices (lerp of scene positions, not re-propagation).
 */
export const PROPAGATE_HZ = 1;

/** Wall-clock spacing between worker SGP4 samples. */
export const PROPAGATE_PERIOD_MS = 1000 / PROPAGATE_HZ;

/** Default instance-color for payloads with no Cala owner color yet. */
export const UNKNOWN_OWNER_COLOR = "#94a3b8";

export const DEFAULT_CITY_ID = "barcelona";
