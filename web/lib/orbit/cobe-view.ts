/** shuding's lat/lon → COBE `phi`/`theta` so a city sits facing the camera. */
export function locationToAngles(latDeg: number, lonDeg: number): { phi: number; theta: number } {
  return {
    phi: Math.PI - ((lonDeg * Math.PI) / 180 - Math.PI / 2),
    theta: (latDeg * Math.PI) / 180,
  };
}

export function lerpAngle(from: number, to: number, t: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

export function markerIdForNorad(noradId: string): string {
  return `sat-${noradId}`;
}
