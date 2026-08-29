// The model registry the assistant accepts. The web UI keeps a display copy
// in web/lib/models.ts — keep the two lists in sync.
export const MODELS = [
	{ id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', provider: 'openai' },
	{ id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', provider: 'anthropic' },
	{ id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'anthropic' },
	{ id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic' },
	{ id: 'google/gemini-3.6-flash', name: 'Gemini 3.6 Flash', provider: 'google' },
	{ id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' },
] as const;

export type ModelId = (typeof MODELS)[number]['id'];

export const MODEL_IDS = MODELS.map((model) => model.id);

export const DEFAULT_MODEL: ModelId = 'openai/gpt-5.6-luna';

// Reasoning effort the assistant accepts. `minimal` is omitted: gpt-5.6-luna
// marks it unsupported, and the rest fall back to provider defaults anyway.
// There is no "off" — that is a model-level value, not one `useModel` takes;
// omitting thinkingLevel is how you get the provider default.
export const THINKING_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export type ThinkingLevelId = (typeof THINKING_LEVELS)[number];

export const DEFAULT_THINKING: ThinkingLevelId = 'medium';
