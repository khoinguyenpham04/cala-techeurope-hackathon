/** Parse HTTP Retry-After (delta-seconds or HTTP-date) into a wait in ms. */
export function parseRetryAfterMs(
  header: string | null | undefined,
  now = Date.now(),
): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (!trimmed) return undefined;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }
  const date = Date.parse(trimmed);
  if (Number.isFinite(date)) {
    return Math.max(0, date - now);
  }
  return undefined;
}

/** Policy block: at least the catalog TTL (2h), longer if Retry-After says so. */
export function policyBlockMs(
  header: string | null | undefined,
  fallbackMs: number,
  now = Date.now(),
): number {
  const fromHeader = parseRetryAfterMs(header, now);
  if (fromHeader === undefined) return fallbackMs;
  return Math.max(fallbackMs, fromHeader);
}
