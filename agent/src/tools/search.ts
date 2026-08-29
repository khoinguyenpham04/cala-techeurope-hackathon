import { defineTool, type JsonValue } from '@flue/runtime';
import * as v from 'valibot';

const MAX_RESULTS = 5;
const SNIPPET_CHAR_LIMIT = 500;
const QUERY_CHAR_LIMIT = 400;
const SOURCES_UNAVAILABLE = 'Sources unavailable';

// Output contract with the web UI: components/chat/transcript.tsx renders a
// Sources block from `results: [{ title, url, snippet, publisher }]`;
// question cards also read `images`. Failures return `{ error, results: [],
// images: [], unavailable: true }` so `results` is always present.
export const webSearch = defineTool({
	name: 'web_search',
	description:
		'Search the public web for sources and photos when Cala returned no citations for this claim. Returns publisher-named links plus image URLs. Call only after Cala tools are empty. Never mention the search vendor by name.',
	input: v.object({
		query: v.pipe(v.string(), v.minLength(1), v.description('Short search query, under 400 characters')),
	}),
	async run({ data, log }): Promise<{ output: JsonValue }> {
		const apiKey = process.env.TAVILY_API_KEY?.trim();
		if (!apiKey) {
			return {
				output: {
					unavailable: true,
					error: SOURCES_UNAVAILABLE,
					message: SOURCES_UNAVAILABLE,
					results: [],
					images: [],
				},
			};
		}
		const query = data.query.trim().slice(0, QUERY_CHAR_LIMIT);
		log.info(`Web search: ${query}`);
		try {
			const response = await fetch('https://api.tavily.com/search', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					query,
					max_results: MAX_RESULTS,
					search_depth: 'basic',
					include_images: true,
					include_image_descriptions: true,
				}),
				signal: AbortSignal.timeout(15_000),
			});
			if (!response.ok) {
				return {
					output: {
						unavailable: true,
						error: SOURCES_UNAVAILABLE,
						message: SOURCES_UNAVAILABLE,
						results: [],
						images: [],
					},
				};
			}
			const payload = (await response.json()) as {
				results?: {
					title?: string;
					url?: string;
					content?: string;
				}[];
				images?: unknown[];
			};
			const results = (payload.results ?? []).slice(0, MAX_RESULTS).map((result) => {
				const url = result.url ?? '';
				const title = result.title ?? '';
				return {
					title: title || url,
					url,
					snippet: (result.content ?? '').slice(0, SNIPPET_CHAR_LIMIT),
					publisher: publisherFromUrl(url, title),
				};
			});
			const images = readImages(payload.images);
			const unavailable = results.length === 0 && images.length === 0;
			return {
				output: {
					unavailable,
					...(unavailable ? { message: SOURCES_UNAVAILABLE } : {}),
					results,
					images,
				},
			};
		} catch {
			return {
				output: {
					unavailable: true,
					error: SOURCES_UNAVAILABLE,
					message: SOURCES_UNAVAILABLE,
					results: [],
					images: [],
				},
			};
		}
	},
});

function publisherFromUrl(url: string, fallback?: string): string {
	try {
		const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
		const known: Record<string, string> = {
			'en.wikipedia.org': 'Wikipedia',
			'wikipedia.org': 'Wikipedia',
			'commons.wikimedia.org': 'Wikimedia',
			'esa.int': 'ESA',
			'www.esa.int': 'ESA',
			'nasa.gov': 'NASA',
			'www.nasa.gov': 'NASA',
			'celestrak.org': 'CelesTrak',
			'space.com': 'Space.com',
			'spacenews.com': 'SpaceNews',
		};
		if (known[host]) return known[host];
		const parts = host.split('.');
		const stem = parts.length >= 2 ? parts[parts.length - 2]! : host;
		if (!stem || /tavily/i.test(stem)) return fallback?.trim() || 'Web';
		return stem.charAt(0).toUpperCase() + stem.slice(1);
	} catch {
		const label = fallback?.trim();
		return label && !/tavily/i.test(label) ? label : 'Web';
	}
}

function readImages(raw: unknown[] | undefined): JsonValue[] {
	if (!Array.isArray(raw)) return [];
	const out: JsonValue[] = [];
	const seen = new Set<string>();
	for (const entry of raw.slice(0, 6)) {
		const src =
			typeof entry === 'string'
				? entry
				: entry && typeof entry === 'object' && typeof (entry as { url?: unknown }).url === 'string'
					? (entry as { url: string }).url
					: '';
		if (!src || seen.has(src) || /tavily/i.test(src)) continue;
		seen.add(src);
		const description =
			entry && typeof entry === 'object' && typeof (entry as { description?: unknown }).description === 'string'
				? (entry as { description: string }).description
				: '';
		out.push({
			src,
			alt: description || 'Related photo',
			credit: publisherFromUrl(src),
			sourceUrl: src,
		});
	}
	return out;
}
