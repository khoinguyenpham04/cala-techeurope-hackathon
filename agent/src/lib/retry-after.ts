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
