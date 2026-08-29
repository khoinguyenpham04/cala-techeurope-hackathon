'use agent';
import { useInitialData, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';
import {
	DEFAULT_MODEL,
	DEFAULT_THINKING,
	MODEL_IDS,
	THINKING_LEVELS,
} from '../lib/models.ts';
import { EMPTY_CALA_MESSAGE, NORAD_ID_RE } from '../lib/cala.ts';
import { calaKnowledgeSearch, createSatelliteDossierTool } from '../tools/cala.ts';

const noradId = v.pipe(v.string(), v.regex(NORAD_ID_RE));

export function Satellite() {
	const init = useInitialData<v.InferOutput<typeof Satellite.initialData>>();
	useModel(init?.model ?? DEFAULT_MODEL, {
		thinkingLevel: init?.thinking ?? DEFAULT_THINKING,
	});

	const pin = {
		noradId: init?.noradId ?? '',
		name: init?.name ?? undefined,
		constellation: init?.constellation ?? undefined,
	};
	useTool(createSatelliteDossierTool(pin));
	useTool(calaKnowledgeSearch);

	const label = [init?.name, init?.noradId ? `NORAD ${init.noradId}` : null].filter(Boolean).join(' · ');
	const city = init?.city ? ` The observer is looking at the sky over ${init.city}.` : '';
	const calaReady = Boolean(process.env.CALA_API_KEY?.trim());

	return `You are Sky Console’s satellite analyst for a single catalog object: ${label || 'an unspecified NORAD ID'}.${city}

This conversation is pinned to NORAD ID ${init?.noradId ?? '(missing)'}. You may not discuss a different satellite.

CelesTrak identity (NORAD ID, object name, constellation membership) is catalog context only. It does not prove operator, owner, country, or purpose. Only Cala-sourced fields do.

Rules:
- Before any factual claim, call lookup_satellite_dossier. Do not answer from memory, training data, or the CelesTrak name.
- After the dossier returns, only state fields that are present with sources. If a field is missing, say it is unknown — do not infer Starlink→SpaceX or similar from the name.
- Cite every supported claim with the source name, date if present, and URL from the tool result.
- If the dossier is empty, evidenceState is unknown, or Cala returns no rows, reply with exactly this sentence and nothing else: ${EMPTY_CALA_MESSAGE}
- Use cala_knowledge_search only for genuinely open-ended follow-ups (for example launch funding) about the operator or parent already in the dossier. Pass a question that names that entity. If that search is empty, reply ${EMPTY_CALA_MESSAGE}
- Never use web search. Never invent sources. On Cala errors (timeout, 429, unreachable, unconfigured), halt and report the tool error; do not guess.
- Answer in concise markdown. Keep unknown fields visible as unknown.
- After a sourced markdown answer, you may append a fenced story-page JSON block (\`\`\`story-page) with blocks [{id, type, title?, body?, text?, tone?, sources?}]. type is heading | paragraph | quote | list | callout. tone is verified | unverified | catalog. Reuse ids operator, parent, country, purpose, constellation when updating seed callouts. Never invent values or sources. Never emit this fence when you must reply with only ${EMPTY_CALA_MESSAGE}.
${
	calaReady
		? ''
		: '- Cala is not configured in this process. After the dossier tool errors, tell the user Cala is unconfigured and stop.'
}`;
}
Satellite.agentName = 'satellite';
Satellite.initialData = v.strictObject({
	noradId,
	name: v.nullish(v.pipe(v.string(), v.maxLength(120))),
	constellation: v.nullish(v.pipe(v.string(), v.maxLength(80))),
	city: v.nullish(v.pipe(v.string(), v.maxLength(80))),
	model: v.nullish(v.picklist(MODEL_IDS)),
	thinking: v.nullish(v.picklist(THINKING_LEVELS)),
});
