// Display copy of the assistant's model registry. The validating source of
// truth is agent/src/lib/models.ts — keep the two lists in sync, or the
// creating send is rejected by the agent's initialData schema.
export interface ChatModel {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "google";
}

export const MODELS: ChatModel[] = [
  { id: "openai/gpt-5.6-luna", name: "GPT-5.6 Luna", provider: "openai" },
  { id: "anthropic/claude-opus-5", name: "Claude Opus 5", provider: "anthropic" },
  { id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5", provider: "anthropic" },
  { id: "anthropic/claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "anthropic" },
  { id: "google/gemini-3.6-flash", name: "Gemini 3.6 Flash", provider: "google" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google" },
];

export const DEFAULT_MODEL = "openai/gpt-5.6-luna";

export const PROVIDERS = [
  { slug: "openai", name: "OpenAI" },
  { slug: "anthropic", name: "Anthropic" },
  { slug: "google", name: "Google" },
] as const;

export function getModel(id: string | undefined): ChatModel | undefined {
  return MODELS.find((model) => model.id === id);
}

// Reasoning effort a NEW conversation is created with. Mirrors
// THINKING_LEVELS in agent/src/lib/models.ts — keep the two in sync, or the
// creating send is rejected by the agent's initialData schema.
export interface ThinkingLevel {
  id: string;
  name: string;
  hint: string;
}

export const THINKING_LEVELS: ThinkingLevel[] = [
  { id: "low", name: "Low", hint: "Fastest, least deliberation" },
  { id: "medium", name: "Medium", hint: "Balanced default" },
  { id: "high", name: "High", hint: "More careful reasoning" },
  { id: "xhigh", name: "Extra high", hint: "Slower, for hard problems" },
  { id: "max", name: "Max", hint: "Maximum deliberation" },
];

export const DEFAULT_THINKING = "medium";

export function getThinkingLevel(id: string | undefined) {
  return THINKING_LEVELS.find((level) => level.id === id);
}
