/**
 * Slim CelesTrak OMM record — only the fields `json2satrec` needs plus
 * identity for the inspector. Numeric fields are normalized to numbers.
 */
export interface SlimOmm {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

export type CatalogSource = "live" | "cache" | "stale";

export interface OrbitCatalogResponse {
  records: SlimOmm[];
  fetchedAt: string | null;
  cachedUntil: string | null;
  source: CatalogSource;
  stale: boolean;
  dropped: number;
  error?: string;
}

export interface ObserverLocation {
  latitudeDeg: number;
  longitudeDeg: number;
  /** Height above WGS-84 ellipsoid, kilometers. */
  heightKm: number;
}

/**
 * One payload currently above the observer (elevation > 0°).
 * Altitude/elevation are the real physical values for the inspector;
 * `displayRadius` is the compressed scene radius for the globe.
 */
export interface VisibleSatellite {
  noradId: string;
  name: string;
  objectId: string;
  latitudeDeg: number;
  longitudeDeg: number;
  /** Real geometric altitude above the ellipsoid, km. */
  altitudeKm: number;
  /** Real observer elevation, degrees. Horizon is 0°. */
  elevationDeg: number;
  azimuthDeg: number;
  rangeKm: number;
  /**
   * Scene-space radius from Earth's center after compressed altitude mapping.
   * Earth surface is `EARTH_RADIUS_SCENE`.
   */
  displayRadius: number;
}

export type EvidenceState = "verified" | "partial" | "unknown";

/**
 * Cala (or any later enricher) attaches verified ownership here.
 * Keyed by NORAD catalog ID as a decimal string (no padding required).
 *
 * Dots render grey until `ownerColor` is set. Unknown objects stay in the
 * headline denominator (`top verified parent count / all visible`).
 */
export interface SatelliteOverlay {
  ownerColor?: string | null;
  ultimateParent?: string | null;
  operator?: string | null;
  purpose?: string | null;
  evidenceState?: EvidenceState;
  sources?: Array<{
    name: string;
    url: string;
    date?: string | null;
  }>;
}

export type SatelliteOverlayMap = Record<string, SatelliteOverlay>;

export type OrbitWorkerIn =
  | { type: "catalog"; records: SlimOmm[] }
  | { type: "observer"; observer: ObserverLocation }
  | { type: "clock"; epochMs: number | null };

export type OrbitWorkerOut =
  | {
      type: "visible";
      epochMs: number;
      satellites: VisibleSatellite[];
    }
  | { type: "error"; message: string };
