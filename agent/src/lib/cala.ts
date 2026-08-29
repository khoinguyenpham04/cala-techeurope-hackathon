/**
 * Typed Cala REST client, provenance helpers, and satellite dossier resolver.
 *
 * Runtime only — `CALA_API_KEY` stays in this process. The Next.js app must
 * call `/api/satellites/*` and never the Cala origin.
 *
 * Two-source join: CelesTrak proves identity (NORAD ID / name / constellation
 * hint). Cala proves operator, ultimate parent, country, and purpose when a
 * property or relationship carries a source. Otherwise the field is omitted
 * and `evidenceState` stays `unknown` or `partial`. CelesTrak membership is
 * not Cala evidence.
 */

export const CALA_BASE_URL = 'https://api.cala.ai/v1';
export const CALA_TIMEOUT_MS = 180_000;
export const EMPTY_CALA_MESSAGE = 'No verified Cala data found';
export const NORAD_ID_RE = /^\d{1,9}$/;

export const MAX_ENRICH_SATELLITES = 120;
export const MAX_UNIQUE_LOOKUPS = 10;

export type EvidenceState = 'verified' | 'partial' | 'unknown';
export type MatchKind = 'satellite' | 'constellation' | 'operator';

export interface CalaSource {
	name: string;
	url: string;
	date?: string;
}

export interface SourcedField {
	value: string;
	sources: CalaSource[];
}

export interface SatelliteDossier {
	noradId: string;
	evidenceState: EvidenceState;
	operator?: SourcedField;
	ultimateParent?: SourcedField;
	country?: SourcedField;
	purpose?: SourcedField;
	sources: CalaSource[];
	colorKey?: string;
	matchKind?: MatchKind;
	entityId?: string;
	entityName?: string;
	celestrakName?: string;
	constellationHint?: string;
}

export interface CatalogObject {
	noradId: string;
	name?: string;
	constellation?: string;
}

export interface EnrichmentRequest {
	selectedNoradId?: string;
	satellites: CatalogObject[];
}

export interface EnrichmentHalt {
	code: 'timeout' | 'rate_limited' | 'unreachable' | 'unconfigured';
	message: string;
}

export interface EnrichmentResponse {
	dossiers: SatelliteDossier[];
	/** NORAD IDs not looked up this round (over the unique-lookup budget). Retry in a later batch. */
	skipped: string[];
	halted?: EnrichmentHalt;
}

export type CalaErrorCode =
	| 'timeout'
	| 'rate_limited'
	| 'unreachable'
	| 'unconfigured'
	| 'http';

export class CalaError extends Error {
	constructor(
		readonly code: CalaErrorCode,
		message: string,
		readonly status?: number,
	) {
		super(message);
		this.name = 'CalaError';
	}
}

export interface CalaEntity {
	id: string;
	name: string;
	entity_type: string;
	description?: string | null;
}

export interface KnowledgeQueryResponse {
	results: Record<string, unknown>[];
	entities: { id: string; name: string; entity_type: string; mentions?: string[] }[] | null;
}

export interface KnowledgeSearchResponse {
	content: string;
	explainability: { content: string; references: string[] }[] | null;
	context: {
		id: string;
		content: string;
		origins: {
			source: { name: string; url: string };
			document: { name: string; url: string };
		}[];
	}[];
	entities: { id: string; name: string; entity_type: string }[] | null;
}

export interface IntrospectionResponse {
	properties: string[];
	relationships: { outgoing: string[]; incoming: string[] };
	numerical_observations: Record<string, unknown>;
}

interface EntityQuery {
	properties?: string[];
	relationships?: {
		outgoing?: Record<string, { limit?: number; offset?: number }>;
		incoming?: Record<string, { limit?: number; offset?: number }>;
	};
}

interface RetrievedEntity {
	id: string;
	name: string;
	entity_type: string;
	description?: string | null;
	properties: Record<string, unknown>;
	relationships: {
		outgoing?: Record<string, RelatedEntity[] | undefined>;
		incoming?: Record<string, RelatedEntity[] | undefined>;
	};
}

interface RelatedEntity {
	id?: string;
	name?: string;
	entity_type?: string;
	properties?: Record<string, unknown>;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const dossierCache = new Map<string, { dossier: SatelliteDossier; expiresAt: number }>();

export function cacheGet(noradId: string): SatelliteDossier | undefined {
	const hit = dossierCache.get(noradId);
	if (!hit) return undefined;
	if (hit.expiresAt < Date.now()) {
		dossierCache.delete(noradId);
		return undefined;
	}
	return hit.dossier;
}

export function cacheSet(dossier: SatelliteDossier) {
	dossierCache.set(dossier.noradId, { dossier, expiresAt: Date.now() + CACHE_TTL_MS });
}

function apiKey(): string {
	const key = process.env.CALA_API_KEY?.trim();
	if (!key) {
		throw new CalaError(
			'unconfigured',
			'Cala is not configured. Set CALA_API_KEY in agent/.env (https://console.cala.ai/api-keys).',
		);
	}
	return key;
}

function isTimeout(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const name = (error as { name?: string }).name;
	const code = (error as { code?: string }).code;
	return name === 'TimeoutError' || name === 'AbortError' || code === 'ABORT_ERR';
}

async function calaFetch(path: string, init: RequestInit): Promise<Response> {
	const key = apiKey();
	const headers = new Headers(init.headers);
	headers.set('X-API-KEY', key);
	if (init.body && !headers.has('content-type')) {
		headers.set('content-type', 'application/json');
	}

	const send = () =>
		fetch(`${CALA_BASE_URL}${path}`, {
			...init,
			headers,
			signal: AbortSignal.timeout(CALA_TIMEOUT_MS),
		});

	let response: Response;
	try {
		response = await send();
	} catch (error) {
		if (isTimeout(error)) {
			try {
				response = await send();
			} catch (retryError) {
				if (isTimeout(retryError)) {
					throw new CalaError(
						'timeout',
						'Cala timed out after a retry. Raise the client timeout to ~180s and retry.',
					);
				}
				throw new CalaError(
					'unreachable',
					'Cala is unreachable. Check https://console.cala.ai/api-keys and https://docs.cala.ai/integrations/mcp.',
				);
			}
		} else {
			throw new CalaError(
				'unreachable',
				'Cala is unreachable. Check https://console.cala.ai/api-keys and https://docs.cala.ai/integrations/mcp.',
			);
		}
	}

	if (response.status === 429) {
		throw new CalaError('rate_limited', 'Cala rate limit exceeded (HTTP 429). Halted; not retrying.', 429);
	}
	return response;
}

async function readJson<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new CalaError(
			response.status >= 500 ? 'unreachable' : 'http',
			`Cala HTTP ${response.status}: ${body.slice(0, 300)}`,
			response.status,
		);
	}
	return (await response.json()) as T;
}

function queryString(params: Record<string, string | number | undefined>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === '') continue;
		search.set(key, String(value));
	}
	const encoded = search.toString();
	return encoded ? `?${encoded}` : '';
}

export async function knowledgeQuery(input: string): Promise<KnowledgeQueryResponse> {
	const response = await calaFetch('/knowledge/query', {
		method: 'POST',
		body: JSON.stringify({ input, return_entities: true }),
	});
	return readJson<KnowledgeQueryResponse>(response);
}

export async function knowledgeSearch(input: string): Promise<KnowledgeSearchResponse> {
	const response = await calaFetch('/knowledge/search', {
		method: 'POST',
		body: JSON.stringify({ input, explainability: true, return_entities: true }),
	});
	return readJson<KnowledgeSearchResponse>(response);
}

export async function entitySearch(
	name: string,
	options: { limit?: number } = {},
): Promise<{ entities: CalaEntity[] }> {
	const response = await calaFetch(
		`/entities${queryString({ name, limit: options.limit ?? 8 })}`,
		{ method: 'GET' },
	);
	return readJson<{ entities: CalaEntity[] }>(response);
}

export async function entityIntrospection(entityId: string): Promise<IntrospectionResponse> {
	const response = await calaFetch(`/entities/${entityId}/introspection`, { method: 'GET' });
	return readJson<IntrospectionResponse>(response);
}

export async function entityRetrieval(entityId: string, query?: EntityQuery): Promise<RetrievedEntity> {
	const response = await calaFetch(`/entities/${entityId}`, {
		method: 'POST',
		body: query ? JSON.stringify(query) : undefined,
	});
	return readJson<RetrievedEntity>(response);
}

export function isTooComplex(result: KnowledgeQueryResponse): boolean {
	if (!Array.isArray(result.results) || result.results.length === 0) return false;
	return result.results.some((row) => {
		const error = row.error;
		return typeof error === 'string' && /too complex/i.test(error);
	});
}

export function isEmptyQuery(result: KnowledgeQueryResponse): boolean {
	if (isTooComplex(result)) return false;
	const rows = result.results ?? [];
	const entities = result.entities ?? [];
	return rows.length === 0 && entities.length === 0;
}

function documentUrl(document: unknown): string {
	if (typeof document === 'string') return document;
	if (!document || typeof document !== 'object') return '';
	const record = document as { url?: unknown; endpoint?: unknown };
	if (typeof record.url === 'string') return record.url;
	if (typeof record.endpoint === 'string') return record.endpoint;
	return '';
}

export function sourcesFromUnknown(value: unknown): CalaSource[] {
	if (!value || typeof value !== 'object') return [];
	const record = value as { sources?: unknown };
	if (!Array.isArray(record.sources)) return [];
	const out: CalaSource[] = [];
	for (const entry of record.sources) {
		if (!entry || typeof entry !== 'object') continue;
		const raw = entry as { name?: unknown; date?: unknown; document?: unknown; url?: unknown };
		const url = documentUrl(raw.document) || (typeof raw.url === 'string' ? raw.url : '');
		const name = typeof raw.name === 'string' && raw.name ? raw.name : url;
		if (!name && !url) continue;
		out.push({
			name: name || 'Cala source',
			url,
			date: typeof raw.date === 'string' && raw.date ? raw.date : undefined,
		});
	}
	return out;
}

function propertyValue(properties: Record<string, unknown>, key: string): SourcedField | undefined {
	const raw = properties[key];
	if (!raw || typeof raw !== 'object') return undefined;
	const value = (raw as { value?: unknown }).value;
	if (typeof value !== 'string' || !value.trim()) return undefined;
	const sources = sourcesFromUnknown(raw);
	if (sources.length === 0) return undefined;
	return { value: value.trim(), sources };
}

function relatedField(rel: RelatedEntity | undefined): SourcedField | undefined {
	if (!rel?.name?.trim()) return undefined;
	const sources = sourcesFromUnknown(rel.properties ?? {});
	if (sources.length === 0) return undefined;
	return { value: rel.name.trim(), sources };
}

function firstRelated(
	bag: Record<string, RelatedEntity[] | undefined> | undefined,
	predicate: (edge: string) => boolean,
): SourcedField | undefined {
	if (!bag) return undefined;
	for (const [edge, rows] of Object.entries(bag)) {
		if (!predicate(edge) || !rows?.length) continue;
		const field = relatedField(rows[0]);
		if (field) return field;
	}
	return undefined;
}

function mergeSources(...groups: (CalaSource[] | undefined)[]): CalaSource[] {
	const byKey = new Map<string, CalaSource>();
	for (const group of groups) {
		if (!group) continue;
		for (const source of group) {
			const key = `${source.url}|${source.name}|${source.date ?? ''}`;
			if (!byKey.has(key)) byKey.set(key, source);
		}
	}
	return [...byKey.values()];
}

function slugColorKey(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
}

function evidenceState(dossier: Pick<SatelliteDossier, 'operator' | 'ultimateParent' | 'country' | 'purpose'>): EvidenceState {
	const filled = [dossier.operator, dossier.ultimateParent, dossier.country, dossier.purpose].filter(Boolean);
	if (filled.length === 0) return 'unknown';
	if (dossier.operator && (dossier.ultimateParent || dossier.country) && filled.length >= 2) return 'verified';
	if (filled.length >= 3) return 'verified';
	return 'partial';
}

function finishDossier(partial: Omit<SatelliteDossier, 'evidenceState' | 'sources' | 'colorKey'> & {
	sources?: CalaSource[];
}): SatelliteDossier {
	const sources = mergeSources(
		partial.sources,
		partial.operator?.sources,
		partial.ultimateParent?.sources,
		partial.country?.sources,
		partial.purpose?.sources,
	);
	const state = evidenceState(partial);
	const colorSeed = partial.ultimateParent?.value ?? partial.operator?.value;
	return {
		...partial,
		evidenceState: state,
		sources,
		colorKey: state === 'unknown' || !colorSeed ? undefined : slugColorKey(colorSeed),
	};
}

function unknownDossier(object: CatalogObject): SatelliteDossier {
	return finishDossier({
		noradId: object.noradId,
		celestrakName: object.name,
		constellationHint: object.constellation ?? constellationFromName(object.name),
	});
}

/**
 * Search hints only — never copied onto a dossier without Cala provenance.
 *
 * Coverage (2026-08-29 REST spike, OpenAPI entity_types + live search):
 * Cala has no Satellite type. Hits are Product (Starlink, Sentinel-2/5P/6),
 * Company/Organization (SpaceX, ONEWEB LIMITED, Eutelsat OneWeb), or
 * Facility (International Space Station, Zarya module). Numbered birds
 * (STARLINK-1008) are not entities; short acronyms (ISS, Sentinel) collide
 * with terrestrial companies. skipCatalogName avoids those queries.
 */
interface ConstellationHint {
	names: string[];
	matchKind: MatchKind;
	/** Mega-constellation or acronym: do not entity_search the CelesTrak vehicle name. */
	skipCatalogName?: boolean;
}

const CONSTELLATION_HINTS: Record<string, ConstellationHint> = {
	STARLINK: { names: ['SpaceX', 'Starlink'], matchKind: 'constellation', skipCatalogName: true },
	ONEWEB: { names: ['Eutelsat OneWeb', 'OneWeb'], matchKind: 'constellation', skipCatalogName: true },
	IRIDIUM: { names: ['Iridium Communications', 'Iridium'], matchKind: 'operator', skipCatalogName: true },
	GLOBALSTAR: { names: ['Globalstar'], matchKind: 'operator', skipCatalogName: true },
	ORBCOMM: { names: ['ORBCOMM'], matchKind: 'operator', skipCatalogName: true },
	GPS: { names: ['United States Space Force', 'GPS'], matchKind: 'operator', skipCatalogName: true },
	NAVSTAR: { names: ['United States Space Force', 'GPS'], matchKind: 'operator', skipCatalogName: true },
	GLONASS: { names: ['Roscosmos', 'GLONASS'], matchKind: 'operator', skipCatalogName: true },
	GALILEO: { names: ['European Union Agency for the Space Programme', 'Galileo'], matchKind: 'constellation', skipCatalogName: true },
	BEIDOU: { names: ['China National Space Administration', 'BeiDou'], matchKind: 'constellation', skipCatalogName: true },
	ISS: { names: ['International Space Station'], matchKind: 'satellite', skipCatalogName: true },
	SENTINEL: { names: ['Copernicus Programme', 'European Space Agency'], matchKind: 'constellation' },
	LANDSAT: { names: ['United States Geological Survey', 'NASA'], matchKind: 'operator' },
	NOAA: { names: ['National Oceanic and Atmospheric Administration'], matchKind: 'operator' },
	GOES: { names: ['National Oceanic and Atmospheric Administration', 'GOES'], matchKind: 'constellation' },
	INTELSAT: { names: ['Intelsat'], matchKind: 'operator' },
	INMARSAT: { names: ['Inmarsat', 'Viasat'], matchKind: 'operator' },
	EUTELSAT: { names: ['Eutelsat'], matchKind: 'operator' },
	SES: { names: ['SES S.A.', 'SES'], matchKind: 'operator' },
	COSMOS: { names: ['Roscosmos'], matchKind: 'operator', skipCatalogName: true },
	YAOGAN: { names: ['China National Space Administration'], matchKind: 'operator', skipCatalogName: true },
	GAOFEN: { names: ['China National Space Administration'], matchKind: 'operator', skipCatalogName: true },
	TIANGONG: { names: ['China Manned Space Agency', 'Tiangong'], matchKind: 'satellite', skipCatalogName: true },
	CSS: { names: ['China Manned Space Agency', 'Tiangong'], matchKind: 'satellite', skipCatalogName: true },
	HST: { names: ['Hubble Space Telescope', 'NASA'], matchKind: 'satellite', skipCatalogName: true },
	HUBBLE: { names: ['Hubble Space Telescope', 'NASA'], matchKind: 'satellite', skipCatalogName: true },
	METEOSAT: { names: ['EUMETSAT'], matchKind: 'operator' },
	METOP: { names: ['EUMETSAT'], matchKind: 'operator' },
	PLANET: { names: ['Planet Labs'], matchKind: 'operator', skipCatalogName: true },
	FLOCK: { names: ['Planet Labs'], matchKind: 'operator', skipCatalogName: true },
	SPIRE: { names: ['Spire Global'], matchKind: 'operator', skipCatalogName: true },
	KUIPER: { names: ['Amazon Kuiper', 'Project Kuiper'], matchKind: 'constellation', skipCatalogName: true },
};

const NAME_PREFIXES = Object.keys(CONSTELLATION_HINTS).sort((a, b) => b.length - a.length);

export function constellationFromName(name: string | undefined): string | undefined {
	if (!name) return undefined;
	const upper = name.toUpperCase();
	for (const prefix of NAME_PREFIXES) {
		if (upper === prefix || upper.startsWith(`${prefix}-`) || upper.startsWith(`${prefix} `) || upper.startsWith(`${prefix}(`)) {
			return prefix;
		}
		if (upper.includes(`(${prefix}`)) return prefix;
	}
	return undefined;
}

function groupKey(object: CatalogObject): string {
	const constellation = (object.constellation ?? constellationFromName(object.name))?.toUpperCase();
	if (constellation) return `constellation:${constellation}`;
	const cleaned = object.name?.replace(/\s+/g, ' ').trim();
	if (cleaned) return `name:${cleaned.toUpperCase()}`;
	return `norad:${object.noradId}`;
}

/** SENTINEL-2A / GOES-16 → series Product name. Does not match STARLINK-1008 (3+ digit vehicles). */
function missionSeriesName(name: string | undefined): string | undefined {
	if (!name) return undefined;
	const cleaned = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
	const series = cleaned.match(/^([A-Za-z]+)\s*[-_](\d{1,2})[A-Za-z]?$/);
	if (!series) return undefined;
	return `${titleCase(series[1])}-${series[2]}`;
}

function searchPlan(object: CatalogObject): { names: string[]; matchKind: MatchKind } {
	const names: string[] = [];
	const push = (value?: string) => {
		const trimmed = value?.trim();
		if (trimmed && !names.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
			names.push(trimmed);
		}
	};

	const constellation = (object.constellation ?? constellationFromName(object.name))?.toUpperCase();
	const hint = constellation ? CONSTELLATION_HINTS[constellation] : undefined;
	const skipCatalog = hint?.skipCatalogName === true;

	if (!skipCatalog) {
		push(missionSeriesName(object.name));
	}
	if (hint) {
		for (const name of hint.names) push(name);
	} else if (constellation) {
		push(titleCase(constellation));
	}
	if (!skipCatalog) {
		const stripped = object.name?.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
		if (stripped && stripped.length > 3) push(stripped);
		if (object.name && object.name.trim().length > 3) push(object.name);
	}

	const matchKind: MatchKind = hint?.matchKind ?? (constellation ? 'constellation' : 'satellite');
	return { names: names.slice(0, 4), matchKind };
}

function titleCase(value: string): string {
	return value
		.toLowerCase()
		.split(/[\s_-]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

const SPACE_SIGNAL_RE =
	/\bsatellites?\b|\bconstellation\b|\baerospace\b|\bspace agency\b|\borbit\b|\bspacecraft\b|\bspace station\b|\bearth observation\b|\bcopernicus\b|\blaunch(?:ed|es| vehicle)?\b|\bpayload\b/i;

const FALSE_FRIEND_RE =
	/\b(?:real estate|realty|accountants?|tourism|hospitality|facilities management|asset management|governance qualityscore|banking company|social commerce|human settlement|municipality)\b/i;

function hasSpaceSignal(entity: CalaEntity): boolean {
	return SPACE_SIGNAL_RE.test(`${entity.name} ${entity.description ?? ''}`);
}

function scoreEntity(entity: CalaEntity, query: string): number {
	let score = 0;
	const name = entity.name.toLowerCase();
	const q = query.toLowerCase();
	const spacey = hasSpaceSignal(entity);
	const falseFriend = FALSE_FRIEND_RE.test(entity.description ?? '') && !spacey;

	if (name === q) score += 80;
	else if (name.includes(q) || q.includes(name)) score += 40;
	if (
		['Company', 'Organization', 'IntergovernmentalOrganization', 'Product', 'Group', 'Facility'].includes(
			entity.entity_type,
		)
	) {
		score += 20;
	}
	if (entity.entity_type === 'Facility' && spacey) score += 15;
	if (entity.entity_type === 'Product' && spacey) score += 10;
	if (entity.entity_type === 'Person' || entity.entity_type === 'Event' || entity.entity_type === 'Municipality') {
		score -= 50;
	}
	if (spacey) score += 25;
	if (falseFriend) score -= 80;
	if (/\d/.test(q) && /\d/.test(entity.name) && !spacey) score -= 40;
	return score;
}

function pickEntity(entities: CalaEntity[], query: string): CalaEntity | undefined {
	let best: CalaEntity | undefined;
	let bestScore = 0;
	for (const entity of entities) {
		const score = scoreEntity(entity, query);
		if (score > bestScore) {
			best = entity;
			bestScore = score;
		}
	}
	if (!best || bestScore < 30) return undefined;
	if (!hasSpaceSignal(best)) return undefined;
	return best;
}

function matchKindFor(entity: CalaEntity, fallback: MatchKind): MatchKind {
	const blob = `${entity.name} ${entity.description ?? ''}`;
	if (entity.entity_type === 'Facility' || /space station|telescope|module of the/i.test(blob)) return 'satellite';
	if (['Company', 'Organization', 'IntergovernmentalOrganization'].includes(entity.entity_type)) return 'operator';
	if (entity.entity_type === 'Product' || /constellation/i.test(blob)) {
		return fallback === 'satellite' ? 'satellite' : 'constellation';
	}
	return fallback;
}

function edgeLooksLike(edge: string, pattern: RegExp): boolean {
	return pattern.test(edge);
}

function dossierFromEntity(entity: RetrievedEntity, matchKind: MatchKind, object: CatalogObject): SatelliteDossier {
	const nameField = propertyValue(entity.properties, 'name') ?? propertyValue(entity.properties, 'legal_name');
	const sourcedSelf: SourcedField | undefined = nameField ?? undefined;

	const outgoing = entity.relationships.outgoing ?? {};
	const incoming = entity.relationships.incoming ?? {};

	const country =
		firstRelated(outgoing, (edge) => edgeLooksLike(edge, /HEADQUARTER|REGISTERED_IN|JURISDICTION|COUNTRY|LOCATED_IN/)) ??
		firstRelated(incoming, (edge) => edgeLooksLike(edge, /HEADQUARTER|REGISTERED_IN|JURISDICTION|COUNTRY/));

	const purpose =
		propertyValue(entity.properties, 'industry') ??
		firstRelated(outgoing, (edge) => edgeLooksLike(edge, /INDUSTRY|PURPOSE|SECTOR|OPERATES_IN/));

	const parent =
		firstRelated(incoming, (edge) => edgeLooksLike(edge, /ULTIMATE_PARENT|DIRECT_PARENT|DIRECT_OWNER|BENEFICIARY_OWNER|SUBSIDIARY_OF/)) ??
		firstRelated(outgoing, (edge) => edgeLooksLike(edge, /IS_SUBSIDIARY_OF|OWNED_BY/));

	const operatedBy =
		firstRelated(outgoing, (edge) => edgeLooksLike(edge, /OPERAT|MANUFACTUR|OWNED_BY|IS_OWNER/)) ??
		firstRelated(incoming, (edge) => edgeLooksLike(edge, /OPERAT|MANUFACTUR|OWNED_BY|IS_OWNER/));

	let operator: SourcedField | undefined;
	if (['Company', 'Organization', 'IntergovernmentalOrganization'].includes(entity.entity_type)) {
		operator = sourcedSelf;
	} else {
		operator = operatedBy;
	}

	let ultimateParent = parent;
	if (!ultimateParent && operator && matchKind === 'operator') {
		const hasSubsidiaries = Object.keys(outgoing).some((edge) => edgeLooksLike(edge, /ULTIMATE_PARENT_OF|DIRECT_PARENT_OF/));
		if (hasSubsidiaries || !parent) ultimateParent = operator;
	}

	return finishDossier({
		noradId: object.noradId,
		operator,
		ultimateParent,
		country,
		purpose,
		matchKind,
		entityId: entity.id,
		entityName: entity.name,
		celestrakName: object.name,
		constellationHint: object.constellation ?? constellationFromName(object.name),
	});
}

function projectionFromIntrospection(intro: IntrospectionResponse): EntityQuery {
	const propertyWanted = ['name', 'legal_name', 'aliases', 'industry', 'bics'];
	const properties = intro.properties.filter((name) => propertyWanted.includes(name));

	const outgoing: Record<string, { limit: number }> = {};
	for (const edge of intro.relationships.outgoing ?? []) {
		if (edgeLooksLike(edge, /HEADQUARTER|REGISTERED_IN|JURISDICTION|COUNTRY|INDUSTRY|PURPOSE|SECTOR|OPERAT|PARENT|OWNER|SUBSIDIARY|LOCATED/)) {
			outgoing[edge] = { limit: 5 };
		}
	}
	const incoming: Record<string, { limit: number }> = {};
	for (const edge of intro.relationships.incoming ?? []) {
		if (edgeLooksLike(edge, /PARENT|OWNER|SUBSIDIARY|OPERAT|BENEFICIARY|REGISTERED|HEADQUARTER/)) {
			incoming[edge] = { limit: 5 };
		}
	}

	return {
		properties,
		relationships: { outgoing, incoming },
	};
}

async function profileEntity(entity: CalaEntity, fallbackKind: MatchKind, object: CatalogObject): Promise<SatelliteDossier> {
	const intro = await entityIntrospection(entity.id);
	const retrieved = await entityRetrieval(entity.id, projectionFromIntrospection(intro));
	return dossierFromEntity(retrieved, matchKindFor(entity, fallbackKind), object);
}

async function resolveFromNames(object: CatalogObject, names: string[], fallbackKind: MatchKind): Promise<SatelliteDossier> {
	for (const name of names) {
		const found = await entitySearch(name, { limit: 8 });
		const best = pickEntity(found.entities ?? [], name);
		if (best) return profileEntity(best, fallbackKind, object);
	}
	return unknownDossier(object);
}

/**
 * Resolve one catalog object. Cache-aware. Throws CalaError on halt conditions.
 */
export async function resolveDossier(object: CatalogObject): Promise<SatelliteDossier> {
	if (!NORAD_ID_RE.test(object.noradId)) {
		return unknownDossier(object);
	}
	const cached = cacheGet(object.noradId);
	if (cached) return cached;

	const plan = searchPlan(object);
	const dossier = await resolveFromNames(object, plan.names, plan.matchKind);
	cacheSet(dossier);
	return dossier;
}

function haltFrom(error: unknown): EnrichmentHalt | undefined {
	if (!(error instanceof CalaError)) return undefined;
	if (error.code === 'http') return undefined;
	return { code: error.code, message: error.message };
}

function applyTemplate(template: SatelliteDossier, object: CatalogObject): SatelliteDossier {
	const dossier = finishDossier({
		...template,
		noradId: object.noradId,
		celestrakName: object.name ?? template.celestrakName,
		constellationHint: object.constellation ?? template.constellationHint ?? constellationFromName(object.name),
	});
	cacheSet(dossier);
	return dossier;
}

/**
 * Bounded bulk enrichment. Groups by constellation/name so 80 Starlinks cost
 * one Cala lookup (Cala has constellation/operator/product entities, not
 * per-NORAD satellites). Selected NORAD is resolved first. Remaining unique
 * groups are capped; extras come back in `skipped` for a later batch. Halts
 * the rest of the batch on 429 / unreachable / timeout.
 */
export async function enrichSatellites(request: EnrichmentRequest): Promise<EnrichmentResponse> {
	const byId = new Map<string, CatalogObject>();
	for (const sat of request.satellites) {
		if (!NORAD_ID_RE.test(sat.noradId)) continue;
		if (!byId.has(sat.noradId)) byId.set(sat.noradId, sat);
	}
	if (request.selectedNoradId && NORAD_ID_RE.test(request.selectedNoradId) && !byId.has(request.selectedNoradId)) {
		byId.set(request.selectedNoradId, { noradId: request.selectedNoradId });
	}

	const ordered: CatalogObject[] = [];
	if (request.selectedNoradId && byId.has(request.selectedNoradId)) {
		ordered.push(byId.get(request.selectedNoradId)!);
	}
	for (const sat of byId.values()) {
		if (sat.noradId !== request.selectedNoradId) ordered.push(sat);
	}

	const dossiers = new Map<string, SatelliteDossier>();
	const pending: CatalogObject[] = [];
	for (const sat of ordered) {
		const cached = cacheGet(sat.noradId);
		if (cached) dossiers.set(sat.noradId, { ...cached, celestrakName: sat.name ?? cached.celestrakName });
		else pending.push(sat);
	}

	const groups = new Map<string, CatalogObject[]>();
	for (const sat of pending) {
		const key = groupKey(sat);
		const list = groups.get(key) ?? [];
		list.push(sat);
		groups.set(key, list);
	}

	const groupEntries = [...groups.entries()].sort((a, b) => {
		const aSelected = request.selectedNoradId && a[1].some((sat) => sat.noradId === request.selectedNoradId);
		const bSelected = request.selectedNoradId && b[1].some((sat) => sat.noradId === request.selectedNoradId);
		if (aSelected && !bSelected) return -1;
		if (bSelected && !aSelected) return 1;
		return b[1].length - a[1].length;
	});

	const lookupBudget = groupEntries.slice(0, MAX_UNIQUE_LOOKUPS);
	const skipped = groupEntries.slice(MAX_UNIQUE_LOOKUPS).flatMap(([, sats]) => sats.map((sat) => sat.noradId));

	let halted: EnrichmentHalt | undefined;
	for (const [, members] of lookupBudget) {
		const sample = members[0];
		if (!sample) continue;
		try {
			const template = await resolveDossier(sample);
			for (const member of members) {
				dossiers.set(member.noradId, applyTemplate(template, member));
			}
		} catch (error) {
			halted = haltFrom(error) ?? {
				code: 'unreachable',
				message: error instanceof Error ? error.message : 'Cala lookup failed.',
			};
			for (const member of members) {
				if (!dossiers.has(member.noradId)) dossiers.set(member.noradId, unknownDossier(member));
			}
			for (const [, rest] of groupEntries) {
				for (const member of rest) {
					if (!dossiers.has(member.noradId) && !skipped.includes(member.noradId)) {
						skipped.push(member.noradId);
					}
				}
			}
			break;
		}
	}

	return {
		dossiers: [...dossiers.values()],
		skipped,
		halted,
	};
}

export function citationsFromSearch(result: KnowledgeSearchResponse): CalaSource[] {
	const byKey = new Map<string, CalaSource>();
	for (const bit of result.context ?? []) {
		for (const origin of bit.origins ?? []) {
			const url = origin.document?.url ?? origin.source?.url ?? '';
			const name = origin.source?.name || origin.document?.name || url;
			if (!name && !url) continue;
			const key = `${url}|${name}`;
			if (!byKey.has(key)) byKey.set(key, { name, url });
		}
	}
	return [...byKey.values()];
}

export function searchIsEmpty(result: KnowledgeSearchResponse): boolean {
	const content = result.content?.trim() ?? '';
	const context = result.context ?? [];
	return (!content || /^no (verified )?data/i.test(content)) && context.length === 0;
}
