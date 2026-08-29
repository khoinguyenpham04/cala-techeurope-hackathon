import { defineTool, type JsonValue } from '@flue/runtime';
import * as v from 'valibot';

const MAX_RESULTS = 5;
const SNIPPET_CHAR_LIMIT = 500;

// Output contract with the web UI: components/chat/transcript.tsx renders a
// Sources block from `results: [{ title, url, snippet }]`; failures return
// `{ error, results: [] }` so `results` is always present. Keep the shape
// stable if the search backend changes.
export const webSearch = defineTool({
	name: 'web_search',
	description:
		'Search the web for current information. Returns the top results with title, URL, and a short snippet. Use for recent events or facts likely to have changed since training.',
	input: v.object({
		query: v.pipe(v.string(), v.minLength(1), v.description('The search query')),
	}),
	async run({ data, log }): Promise<{ output: JsonValue }> {
		const apiKey = process.env.TAVILY_API_KEY;
		if (!apiKey) {
			return { output: { error: 'Web search is not configured (TAVILY_API_KEY is unset).', results: [] } };
		}
		log.info(`Searching the web: ${data.query}`);
		try {
			const response = await fetch('https://api.tavily.com/search', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({ query: data.query, max_results: MAX_RESULTS }),
				signal: AbortSignal.timeout(15_000),
			});
			if (!response.ok) {
				const body = await response.text();
				return { output: { error: `Tavily API ${response.status}: ${body.slice(0, 300)}`, results: [] } };
			}
			const payload = (await response.json()) as {
				results?: { title?: string; url?: string; content?: string }[];
			};
			const results = (payload.results ?? []).slice(0, MAX_RESULTS).map((result) => ({
				title: result.title ?? '',
				url: result.url ?? '',
				snippet: (result.content ?? '').slice(0, SNIPPET_CHAR_LIMIT),
			}));
			return { output: { results } };
		} catch (error) {
			return { output: { error: (error as Error).message, results: [] } };
		}
	},
});
