/** Mean Earth radius (km) used for geodetic height → scene scale. */
export const EARTH_RADIUS_KM = 6371;

/** Earth radius in Three.js scene units. */
export const EARTH_RADIUS_SCENE = 1.6;

/** Axial tilt applied to the ECEF group for a cinematic globe. */
export const EARTH_TILT_DEG = 23.4;

/**
 * Extra multiplier on compressed altitude so the LEO shell reads as a halo
 * when the camera is pulled back. Real `altitudeKm` is unchanged.
 */
export const DISPLAY_ALTITUDE_SCALE = 1.4;

/** Perspective camera — pulled back so full Earth + LEO shell fit in frame. */
export const CAMERA_FOV = 40;
export const CAMERA_NEAR = 0.15;
export const CAMERA_FAR = 160;
/**
 * Polar-ish high tilt, looking at the origin.
 * Distance ≈ 9.21 scene units (Earth radius 1.6).
 */
export const CAMERA_DEFAULT_POSITION: [number, number, number] = [0.25, 5.55, 7.35];
export const CAMERA_MIN_DISTANCE = 3.0;
export const CAMERA_MAX_DISTANCE = 16;

/** Observer elevation strictly greater than this (degrees) counts as above-horizon. */
export const HORIZON_ELEVATION_DEG = 0;

/** Successful CelesTrak downloads are reused for this long. */
export const CATALOG_TTL_MS = 2 * 60 * 60 * 1000;

/** After a non-200 CelesTrak response, do not retry until this elapses. */
export const CELESTRAK_BLOCK_MS = CATALOG_TTL_MS;

/**
 * HUD copy when CelesTrak is 403/non-200. We serve a disk snapshot or the
 * bundled seed and do not retry for `CELESTRAK_BLOCK_MS` (~2h). Keep this in
 * the HUD — never as a globe-center overlay ("not retrying yet").
 */
export const CELESTRAK_STALE_MESSAGE =
  "CelesTrak returned 403, so this is a saved catalog (or the bundled demo), not a live download. We wait about 2 hours before asking again.";

/** Visual InstancedMesh sphere radius (scene units). Tiny values are unclickable. */
export const SATELLITE_DOT_RADIUS = 0.042;

/** Invisible pick sphere — larger than the dot so NORAD selection actually hits. */
export const SATELLITE_PICK_RADIUS = 0.14;

/**
 * COBE markers are a JS array uploaded every frame. Cap well below the full
 * active catalog so the 5KB globe stays light; the HUD still counts every
 * visible payload. The selected NORAD is always included even if it falls
 * outside this window.
 */
export const COBE_MAX_MARKERS = 480;

/** DOM satellite icons (CSS anchors). Search still selects anything in the catalog. */
export const COBE_HIT_TARGET_MAX = 200;

/**
 * COBE marker size is relative to globe radius and must stay in 0.01–0.1.
 * Size 0 breaks CSS anchoring. City stays a round canvas pin; satellites use a
 * tiny in-range pin so `--cobe-{id}` still exists under the SVG overlay.
 */
export const COBE_CITY_MARKER_SIZE = 0.055;
export const COBE_SAT_MARKER_SIZE = 0.01;
export const COBE_SAT_SELECTED_MARKER_SIZE = 0.014;

/** Short backoff after a network/timeout failure so we do not hammer the endpoint. */
export const CELESTRAK_TRANSIENT_BACKOFF_MS = 60_000;

export const CELESTRAK_ACTIVE_OMM_URL =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=JSON";

/**
 * Two clocks, do not mix them:
 * - SGP4 clock (`PROPAGATE_HZ`, 1 Hz) lives in the orbit worker. `json2satrec`
 *   runs once per catalog load; `propagate` + horizon filter run only on this
 *   tick. Never call SGP4 / `json2satrec` inside the COBE rAF loop.
 * - Render clock interpolates the latest two 1 Hz samples onto COBE markers
 *   (lerp of lat/lon, not re-propagation).
 */
export const PROPAGATE_HZ = 1;

/** Wall-clock spacing between worker SGP4 samples. */
export const PROPAGATE_PERIOD_MS = 1000 / PROPAGATE_HZ;

/** Default instance-color for payloads with no Cala owner color yet. */
export const UNKNOWN_OWNER_COLOR = "#e2e8f0";

export const DEFAULT_CITY_ID = "barcelona";
