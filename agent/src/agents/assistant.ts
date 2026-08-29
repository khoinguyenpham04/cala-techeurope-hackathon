'use agent';
import { useInitialData, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';
import {
	DEFAULT_MODEL,
	DEFAULT_THINKING,
	MODEL_IDS,
	THINKING_LEVELS,
} from '../lib/models.ts';
import { webSearch } from '../tools/search.ts';

// A general-purpose chat assistant. The web UI picks the model per
// conversation: the creating send carries `initialData: { model }`, validated
// against the registry; conversations created without it use DEFAULT_MODEL.
export function Assistant() {
	const init = useInitialData<v.InferOutput<typeof Assistant.initialData>>();
	useModel(init?.model ?? DEFAULT_MODEL, {
		thinkingLevel: init?.thinking ?? DEFAULT_THINKING,
	});

	const searchEnabled = Boolean(process.env.TAVILY_API_KEY);
	if (searchEnabled) useTool(webSearch);

	return `You are a helpful, general-purpose AI assistant.

- Answer in well-structured markdown; use code blocks with language tags for code.
- Be direct and concise by default; expand into detail when the question calls for it.
- If you are unsure or lack the information to answer, say so plainly instead of guessing.${
		searchEnabled
			? `
- You have a web_search tool. Use it for current events, recent releases, prices, or any fact likely to have changed since your training data — then base your answer on the results and mention which sources you used.`
			: ''
	}`;
}
Assistant.agentName = 'assistant';
// strictObject so a misnamed key fails the creating send instead of silently
// pinning the conversation to the default model; nullish so JSON null (the
// natural "no preference" serialization) is accepted like absence.
Assistant.initialData = v.nullish(
	v.strictObject({
		model: v.nullish(v.picklist(MODEL_IDS)),
		thinking: v.nullish(v.picklist(THINKING_LEVELS)),
	}),
);
