import { HORIZON_ELEVATION_DEG } from "@/lib/orbit/constants";

/** Observer elevation > 0° (strict) counts as above the city. */
export function isAboveHorizon(
  elevationDeg: number,
  horizonDeg = HORIZON_ELEVATION_DEG,
): boolean {
  return Number.isFinite(elevationDeg) && elevationDeg > horizonDeg;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
