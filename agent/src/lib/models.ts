// The model registry the assistant accepts. The web UI keeps a display copy
// in web/lib/models.ts — keep the two lists in sync.
export const MODELS = [
	{ id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', provider: 'anthropic' },
	{ id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'anthropic' },
	{ id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic' },
	{ id: 'google/gemini-3.6-flash', name: 'Gemini 3.6 Flash', provider: 'google' },
	{ id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' },
] as const;

export type ModelId = (typeof MODELS)[number]['id'];

export const MODEL_IDS = MODELS.map((model) => model.id);

export const DEFAULT_MODEL: ModelId = 'google/gemini-2.5-flash';
