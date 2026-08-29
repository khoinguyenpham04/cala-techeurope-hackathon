// Display copy of the assistant's model registry. The validating source of
// truth is agent/src/lib/models.ts — keep the two lists in sync, or the
// creating send is rejected by the agent's initialData schema.
export interface ChatModel {
  id: string;
  name: string;
  provider: "anthropic" | "google";
}

export const MODELS: ChatModel[] = [
  { id: "anthropic/claude-opus-5", name: "Claude Opus 5", provider: "anthropic" },
  { id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5", provider: "anthropic" },
  { id: "anthropic/claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "anthropic" },
  { id: "google/gemini-3.6-flash", name: "Gemini 3.6 Flash", provider: "google" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google" },
];

export const DEFAULT_MODEL = "google/gemini-2.5-flash";

export const PROVIDERS = [
  { slug: "anthropic", name: "Anthropic" },
  { slug: "google", name: "Google" },
] as const;

export function getModel(id: string | undefined): ChatModel | undefined {
  return MODELS.find((model) => model.id === id);
}
