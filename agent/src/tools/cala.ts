import { defineTool, type JsonValue } from '@flue/runtime';
import * as v from 'valibot';
import {
	CalaError,
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
			'Load the sourced Cala dossier for the satellite pinned to this conversation. Treat the operator field conservatively as a Cala-linked organization unless its source explicitly proves operational control. Call this before any ownership claim. If empty is true, leave card 2 as the catalog brief and answer the user question on a new card (use web_search only when Cala has no sources). Do not write an empty-Cala sentence into the lesson.',
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
						sources: dossier.sources,
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
 * Never a substitute for the dossier tool. If empty, the model may then
 * call web_search for a new question card.
 */
export const calaKnowledgeSearch = defineTool({
	name: 'cala_knowledge_search',
	description:
		'Ask Cala an open-ended sourced question about this satellite’s operator, owner, or purpose (for example launch funding). Use only after lookup_satellite_dossier. Do not use for facts the dossier already covers. If empty is true or sources is empty, call web_search next. Do not write an empty-Cala sentence into the lesson.',
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
					content: empty ? '' : result.content,
					sources,
					explainability: result.explainability,
					context: result.context,
					empty,
				}),
			};
		} catch (error) {
			return { output: toolError(error) };
		}
	},
});
