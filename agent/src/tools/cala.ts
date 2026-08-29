import { defineTool, type JsonValue } from '@flue/runtime';
import * as v from 'valibot';
import {
	CalaError,
	EMPTY_CALA_MESSAGE,
	citationsFromSearch,
	knowledgeSearch,
	resolveDossier,
	searchIsEmpty,
	type CatalogObject,
	type SatelliteDossier,
} from '../lib/cala.ts';

function asJson(value: unknown): JsonValue {
	return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function toolError(error: unknown): JsonValue {
	if (error instanceof CalaError) {
		return { error: error.message, code: error.code, empty: true, sources: [] };
	}
	return {
		error: error instanceof Error ? error.message : 'Cala lookup failed.',
		code: 'unreachable',
		empty: true,
		sources: [],
	};
}

/** Pinned to the conversation's NORAD ID — the model cannot retarget it. */
export function createSatelliteDossierTool(pin: CatalogObject) {
	return defineTool({
		name: 'lookup_satellite_dossier',
		description:
			'Load the verified Cala dossier for the satellite pinned to this conversation. Call this before any factual claim about operator, owner, country, or purpose. Empty evidence means you must answer exactly: No verified Cala data found',
		input: v.object({}),
		async run({ log }): Promise<{ output: JsonValue }> {
			log.info(`Cala dossier NORAD ${pin.noradId}`);
			try {
				const dossier: SatelliteDossier = await resolveDossier(pin);
				const empty = dossier.evidenceState === 'unknown';
				return {
					output: asJson({
						...dossier,
						empty,
						message: empty ? EMPTY_CALA_MESSAGE : undefined,
					}),
				};
			} catch (error) {
				return { output: toolError(error) };
			}
		},
	});
}

/**
 * Open-ended Cala search only (launch funding, corporate events, etc.).
 * Never a substitute for the dossier tool, and never a web-search fallback.
 */
export const calaKnowledgeSearch = defineTool({
	name: 'cala_knowledge_search',
	description:
		'Ask Cala an open-ended sourced question about this satellite’s operator, owner, or purpose (for example launch funding). Use only after lookup_satellite_dossier. Do not use for facts the dossier already covers. Cite every claim from the returned sources.',
	input: v.object({
		query: v.pipe(
			v.string(),
			v.minLength(3),
			v.description('Natural-language question constrained to this satellite’s verified operator or owner'),
		),
	}),
	async run({ data, log }): Promise<{ output: JsonValue }> {
		log.info(`Cala knowledge_search: ${data.query}`);
		try {
			const result = await knowledgeSearch(data.query);
			const sources = citationsFromSearch(result);
			const empty = searchIsEmpty(result);
			return {
				output: asJson({
					content: empty ? EMPTY_CALA_MESSAGE : result.content,
					sources,
					explainability: result.explainability,
					context: result.context,
					empty,
					message: empty ? EMPTY_CALA_MESSAGE : undefined,
				}),
			};
		} catch (error) {
			return { output: toolError(error) };
		}
	},
});
