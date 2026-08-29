import type { FlueConversationMessage } from "@flue/react";

/** Matches the web_search tool in agent/src/tools/search.ts. */
export const WEB_SEARCH_TOOL = "web_search";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function readResults(output: unknown): SearchResult[] {
  if (!output || typeof output !== "object") return [];
  const results = (output as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { title, url, snippet } = entry as Record<string, unknown>;
    if (typeof url !== "string" || !url) return [];
    return [
      {
        snippet: typeof snippet === "string" ? snippet : "",
        title: typeof title === "string" && title ? title : url,
        url,
      },
    ];
  });
}

/** Every source the assistant's searches returned, de-duplicated by URL. */
export function searchSources(message: FlueConversationMessage): SearchResult[] {
  const byUrl = new Map<string, SearchResult>();
  for (const part of message.parts) {
    if (part.type !== "dynamic-tool") continue;
    if (part.toolName !== WEB_SEARCH_TOOL || part.state !== "output-available") continue;
    for (const result of readResults(part.output)) {
      if (!byUrl.has(result.url)) byUrl.set(result.url, result);
    }
  }
  return [...byUrl.values()];
}
