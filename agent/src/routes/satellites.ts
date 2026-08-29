import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import * as v from 'valibot';
import {
	CalaError,
	MAX_ENRICH_SATELLITES,
	NORAD_ID_RE,
	enrichSatellites,
	resolveDossier,
	type CatalogObject,
} from '../lib/cala.ts';

const catalogObject = v.object({
	noradId: v.pipe(v.string(), v.regex(NORAD_ID_RE)),
	name: v.optional(v.pipe(v.string(), v.maxLength(120))),
	constellation: v.optional(v.pipe(v.string(), v.maxLength(80))),
});

const enrichBody = v.object({
	selectedNoradId: v.optional(v.pipe(v.string(), v.regex(NORAD_ID_RE))),
	satellites: v.pipe(v.array(catalogObject), v.minLength(1), v.maxLength(MAX_ENRICH_SATELLITES)),
});

function haltStatus(code: string): ContentfulStatusCode {
	if (code === 'unconfigured') return 503;
	if (code === 'rate_limited') return 429;
	if (code === 'timeout') return 504;
	if (code === 'unreachable') return 503;
	return 502;
}

function errorPayload(error: unknown) {
	if (error instanceof CalaError) {
		return {
			error: { code: error.code, message: error.message },
			dossiers: [] as const,
			skipped: [] as const,
		};
	}
	return {
		error: {
			code: 'unreachable',
			message: error instanceof Error ? error.message : 'Cala lookup failed.',
		},
		dossiers: [] as const,
		skipped: [] as const,
	};
}

/**
 * Same-origin satellite data API. The Next app rewrites `/api/satellites/*`
 * here. The globe POSTs visible NORAD IDs (plus optional CelesTrak name /
 * constellation hints); selected object first. Never returns the Cala key.
 */
export const satellites = new Hono();

satellites.get('/status', (c) =>
	c.json({ configured: Boolean(process.env.CALA_API_KEY?.trim()) }),
);

satellites.post('/enrich', async (c) => {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: { code: 'http', message: 'Expected JSON body.' } }, 400);
	}
	const parsed = v.safeParse(enrichBody, body);
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: 'http',
					message: `Invalid enrich request (max ${MAX_ENRICH_SATELLITES} satellites, NORAD IDs are 1–9 digits).`,
				},
			},
			400,
		);
	}

	try {
		const result = await enrichSatellites(parsed.output);
		if (result.halted && result.dossiers.length === 0) {
			return c.json(
				{ error: result.halted, dossiers: result.dossiers, skipped: result.skipped },
				haltStatus(result.halted.code),
			);
		}
		return c.json(result);
	} catch (error) {
		const payload = errorPayload(error);
		const code = payload.error.code;
		return c.json(payload, haltStatus(code));
	}
});

satellites.get('/:noradId', async (c) => {
	const noradId = c.req.param('noradId');
	if (!NORAD_ID_RE.test(noradId)) {
		return c.json({ error: { code: 'http', message: 'NORAD ID must be 1–9 digits.' } }, 400);
	}
	const object: CatalogObject = {
		noradId,
		name: c.req.query('name') || undefined,
		constellation: c.req.query('constellation') || undefined,
	};
	try {
		const dossier = await resolveDossier(object);
		return c.json({ dossier });
	} catch (error) {
		const payload = errorPayload(error);
		return c.json(payload, haltStatus(payload.error.code));
	}
});
