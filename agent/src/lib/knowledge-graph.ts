/**
 * Local knowledge graph: constellation/operator entity → Cala UUID + sourced
 * fields. Persisted under `agent/data/` (gitignored). Never write 40k NORAD
 * rows — one Starlink node paints every bird that shares the group key.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BUNDLED_CALA_RECORDS } from './bundled-evidence.ts';
import { seedFromGroupKey, type MegaSeed } from './constellation-seeds.ts';
import type {
	CalaSource,
	CatalogObject,
	EvidenceState,
	MatchKind,
	SatelliteDossier,
	SourcedField,
} from './cala.ts';

const GRAPH_VERSION = 1;
const MIN_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 15 * 60 * 1000;
const GRAPH_PATH = path.join(process.cwd(), 'data', 'knowledge-graph.json');

export interface GraphCalaRecord {
	entityId: string;
	entityName: string;
	entityType?: string;
	operator?: SourcedField;
	ultimateParent?: SourcedField;
	country?: SourcedField;
	purpose?: SourcedField;
	sources: CalaSource[];
	evidenceState: EvidenceState;
	colorKey?: string;
	matchKind: MatchKind;
	fetchedAt: string;
}

export interface GraphNode {
	key: string;
	matchKind: MatchKind;
	seed?: MegaSeed;
	cala?: GraphCalaRecord;
	lookupAttempted?: boolean;
	lookupAttemptedAt?: string;
}

interface PersistedGraph {
	version: number;
	rateLimitedUntil: number;
	backoffMs: number;
	strike: number;
	nodes: Record<string, GraphNode>;
}

const nodes = new Map<string, GraphNode>();
let rateLimitedUntil = 0;
let backoffMs = MIN_BACKOFF_MS;
let strike = 0;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let persistChain = Promise.resolve();

function defaultNode(key: string): GraphNode | undefined {
	const seed = seedFromGroupKey(key);
	if (!seed) return undefined;
	return { key, matchKind: seed.matchKind, seed };
}

async function hydrateFromDisk() {
	for (const [key, cala] of Object.entries(BUNDLED_CALA_RECORDS)) {
		const seed = seedFromGroupKey(key);
		nodes.set(key, {
			key,
			matchKind: cala.matchKind,
			seed,
			cala,
			lookupAttempted: true,
			lookupAttemptedAt: cala.fetchedAt,
		});
	}
	try {
		const raw = await readFile(GRAPH_PATH, 'utf8');
		const parsed = JSON.parse(raw) as PersistedGraph;
		if (parsed.version !== GRAPH_VERSION || !parsed.nodes) return;
		rateLimitedUntil = typeof parsed.rateLimitedUntil === 'number' ? parsed.rateLimitedUntil : 0;
		backoffMs =
			typeof parsed.backoffMs === 'number' && parsed.backoffMs >= MIN_BACKOFF_MS
				? parsed.backoffMs
				: MIN_BACKOFF_MS;
		strike = typeof parsed.strike === 'number' && parsed.strike >= 0 ? parsed.strike : 0;
		for (const [key, node] of Object.entries(parsed.nodes)) {
			if (!node || typeof node !== 'object') continue;
			const seed = node.seed ?? seedFromGroupKey(key);
			nodes.set(key, {
				...node,
				key,
				seed,
				cala: node.cala ? sanitizeCalaRecord(node.cala) : undefined,
				matchKind: node.matchKind ?? seed?.matchKind ?? 'operator',
			});
		}
	} catch {
		// Missing or corrupt snapshot — start empty; seeds fill in on demand.
	}
}

export async function ensureGraphHydrated() {
	if (hydrated) return;
	if (!hydratePromise) {
		hydratePromise = hydrateFromDisk().finally(() => {
			hydrated = true;
		});
	}
	await hydratePromise;
}

function persist() {
	persistChain = persistChain
		.then(async () => {
			await mkdir(path.dirname(GRAPH_PATH), { recursive: true });
			const payload: PersistedGraph = {
				version: GRAPH_VERSION,
				rateLimitedUntil,
				backoffMs,
				strike,
				nodes: Object.fromEntries(nodes),
			};
			await writeFile(GRAPH_PATH, JSON.stringify(payload), 'utf8');
		})
		.catch(() => {
			// Disk full / permissions — keep serving from memory.
		});
}

export function getGraphNode(key: string): GraphNode | undefined {
	let node = nodes.get(key);
	if (!node) {
		node = defaultNode(key);
		if (node) {
			nodes.set(key, node);
			persist();
		}
	}
	return node;
}

export function putGraphCala(key: string, cala: GraphCalaRecord) {
	const sanitized = sanitizeCalaRecord(cala);
	const existing = getGraphNode(key) ?? { key, matchKind: sanitized.matchKind };
	nodes.set(key, {
		...existing,
		key,
		matchKind: sanitized.matchKind,
		cala: sanitized,
		lookupAttempted: true,
		lookupAttemptedAt: sanitized.fetchedAt,
	});
	persist();
}

export function markGraphLookupAttempted(key: string, matchKind: MatchKind) {
	const existing = getGraphNode(key) ?? { key, matchKind };
	nodes.set(key, {
		...existing,
		key,
		matchKind: existing.matchKind ?? matchKind,
		lookupAttempted: true,
		lookupAttemptedAt: new Date().toISOString(),
	});
	persist();
}

export function graphHasSourcedCala(node: GraphNode | undefined): boolean {
	return Boolean(node?.cala && node.cala.evidenceState !== 'unknown');
}

export function isGraphLookupFresh(node: GraphNode | undefined): boolean {
	if (!node) return false;
	if (node.cala) return true;
	return node.lookupAttempted === true;
}

export function getRateLimitState(now = Date.now()): {
	blocked: boolean;
	retryAfterMs: number;
	backoffMs: number;
} {
	const retryAfterMs = Math.max(0, rateLimitedUntil - now);
	return { blocked: retryAfterMs > 0, retryAfterMs, backoffMs };
}

export function recordRateLimit(headerWaitMs?: number, now = Date.now()) {
	strike += 1;
	backoffMs = Math.min(MAX_BACKOFF_MS, MIN_BACKOFF_MS * 2 ** Math.max(0, strike - 1));
	const wait = Math.max(headerWaitMs ?? 0, backoffMs);
	rateLimitedUntil = now + wait;
	persist();
	return wait;
}

export function clearRateLimit() {
	rateLimitedUntil = 0;
	backoffMs = MIN_BACKOFF_MS;
	strike = 0;
	persist();
}

function sourced(field?: SourcedField): SourcedField | undefined {
	if (!field?.value?.trim()) return undefined;
	const sources = field.sources.filter((source) => source.url.trim());
	if (!sources.length) return undefined;
	return { value: field.value.trim(), sources };
}

function sanitizeCalaRecord(cala: GraphCalaRecord): GraphCalaRecord {
	const operator = sourced(cala.operator);
	const country = sourced(cala.country);
	const purpose = sourced(cala.purpose);
	const filled = [operator, country, purpose].filter(Boolean).length;
	const sources = new Map<string, CalaSource>();
	for (const field of [operator, country, purpose]) {
		for (const source of field?.sources ?? []) {
			sources.set(`${source.url}|${source.date ?? ''}`, source);
		}
	}
	return {
		...cala,
		operator,
		// Historical snapshots may have treated a shareholder/direct owner as
		// an ultimate parent. Drop it until a strict parent edge is resolved.
		ultimateParent: undefined,
		country,
		purpose,
		sources: [...sources.values()],
		evidenceState: filled === 0 ? 'unknown' : filled >= 3 ? 'verified' : 'partial',
		colorKey: operator ? cala.colorKey : undefined,
	};
}

export function dossierFromGraphNode(node: GraphNode, object: CatalogObject): SatelliteDossier {
	const cala = node.cala ? sanitizeCalaRecord(node.cala) : undefined;
	if (cala && cala.evidenceState !== 'unknown') {
		return {
			noradId: object.noradId,
			evidenceState: cala.evidenceState,
			operator: sourced(cala.operator),
			ultimateParent: undefined,
			country: sourced(cala.country),
			purpose: sourced(cala.purpose),
			sources: cala.sources,
			colorKey: cala.colorKey,
			matchKind: cala.matchKind,
			entityId: cala.entityId,
			entityName: cala.entityName,
			celestrakName: object.name,
			constellationHint: object.constellation,
			seeded: false,
		};
	}

	const seed = node.seed;
	if (seed) {
		const operator = seed.operator ? { value: seed.operator, sources: [] } : undefined;
		const ultimateParent = seed.ultimateParent ? { value: seed.ultimateParent, sources: [] } : undefined;
		const purpose = seed.purpose ? { value: seed.purpose, sources: [] } : undefined;
		return {
			noradId: object.noradId,
			evidenceState: 'unknown',
			operator,
			ultimateParent,
			purpose,
			sources: [],
			colorKey: seed.colorKey,
			matchKind: seed.matchKind,
			celestrakName: object.name,
			constellationHint: object.constellation,
			seeded: true,
		};
	}

	return {
		noradId: object.noradId,
		evidenceState: 'unknown',
		sources: [],
		matchKind: node.matchKind,
		celestrakName: object.name,
		constellationHint: object.constellation,
		seeded: false,
	};
}

/** Test seam. */
export function resetKnowledgeGraph() {
	nodes.clear();
	rateLimitedUntil = 0;
	backoffMs = MIN_BACKOFF_MS;
	strike = 0;
	hydrated = true;
	hydratePromise = Promise.resolve();
}
