import { DISPLAY_ALTITUDE_SCALE, EARTH_RADIUS_SCENE } from "@/lib/orbit/constants";

/**
 * Compressed altitude scale (scene units above the unit-Earth surface).
 *
 * Real altitude stays on `VisibleSatellite.altitudeKm` for the inspector.
 * Display uses this piecewise map so LEO / MEO / GEO stay readable on one globe
 * instead of GEO sitting ~6.6 Earth-radii out:
 *
 * | Band              | Real altitude     | Offset above surface |
 * |-------------------|-------------------|----------------------|
 * | LEO               | 0 – 2,000 km      | 0.05 – 0.32 (linear) |
 * | MEO               | 2,000 – 20,000 km | 0.32 – 0.48 (log)    |
 * | GEO and beyond    | 20,000 – 50,000 km| 0.48 – 0.58 (log)    |
 *
 * GEO (35,786 km) lands near +0.55 before `DISPLAY_ALTITUDE_SCALE`.
 * Display radius multiplies that offset (1.4×) so the LEO shell reads as a
 * halo when the camera is pulled back. Inspector `altitudeKm` is unchanged.
 */
export function compressedAltitudeOffset(altitudeKm: number): number {
  const alt = Math.max(0, altitudeKm);
  if (alt <= 2000) {
    return 0.05 + (alt / 2000) * 0.27;
  }
  if (alt <= 20_000) {
    const t = Math.log(alt / 2000) / Math.log(20_000 / 2000);
    return 0.32 + t * 0.16;
  }
  const capped = Math.min(alt, 50_000);
  const t = Math.log(capped / 20_000) / Math.log(50_000 / 20_000);
  return 0.48 + t * 0.1;
}

export function displayRadiusFromAltitudeKm(
  altitudeKm: number,
  earthRadius = EARTH_RADIUS_SCENE,
): number {
  return earthRadius + compressedAltitudeOffset(altitudeKm) * DISPLAY_ALTITUDE_SCALE;
}
