/**
 * Legacy `story-graph` JSON fence. The right pane is a Lexical page now;
 * this parser exists so older agent fences still update callout blocks.
 * See docs/generative-sky-canvas.md.
 */

export const STORY_GRAPH_FENCE = "story-graph";

export type StoryProvenance = "catalog" | "cala" | "unverified" | "generated";
export type StoryNodeKind = "object" | "entity" | "source" | "plan" | "lesson";

export interface StorySource {
  name: string;
  url: string;
  date?: string | null;
}

export type StoryNodePayload = {
  kind: StoryNodeKind;
  title: string;
  subtitle?: string;
  value: string;
  known: boolean;
  provenance: StoryProvenance;
  evidenceState?: "verified" | "partial" | "unknown";
  sources?: StorySource[];
  streaming?: boolean;
  noradId?: string;
};

export interface StoryGraphNode {
  id: string;
  data: StoryNodePayload;
}

export interface StoryGraph {
  nodes: StoryGraphNode[];
}

const NODE_KINDS = new Set<StoryNodeKind>([
  "object",
  "entity",
  "source",
  "plan",
  "lesson",
]);

const PROVENANCE = new Set<StoryProvenance>([
  "catalog",
  "cala",
  "unverified",
  "generated",
]);

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readSources(value: unknown): StorySource[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sources: StorySource[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const url = asString(entry.url);
    const name = asString(entry.name) ?? url;
    if (!name && !url) continue;
    sources.push({
      name: name || "Cala source",
      url: url ?? "",
      date: asString(entry.date) ?? null,
    });
  }
  return sources.length > 0 ? sources : undefined;
}

function readGraphPayload(value: unknown): StoryGraph | null {
  if (!isRecord(value)) return null;
  const rawNodes = Array.isArray(value.nodes) ? value.nodes : null;
  if (!rawNodes || rawNodes.length === 0) return null;

  const nodes: StoryGraphNode[] = [];
  for (const [index, entry] of rawNodes.slice(0, 24).entries()) {
    if (!isRecord(entry)) continue;
    const id = asString(entry.id) ?? `extra-${index}`;
    const kindRaw = asString(entry.kind);
    const kind: StoryNodeKind =
      kindRaw && NODE_KINDS.has(kindRaw as StoryNodeKind)
        ? (kindRaw as StoryNodeKind)
        : "entity";
    const valueText = asString(entry.value) ?? "Unknown";
    const provenanceRaw = asString(entry.provenance);
    const provenance: StoryProvenance =
      provenanceRaw && PROVENANCE.has(provenanceRaw as StoryProvenance)
        ? (provenanceRaw as StoryProvenance)
        : "unverified";
    const known = provenance === "unverified" ? false : valueText !== "Unknown";
    nodes.push({
      id,
      data: {
        kind,
        title: asString(entry.title) ?? kind,
        subtitle: asString(entry.subtitle),
        value: valueText,
        known,
        provenance,
        sources: readSources(entry.sources),
      },
    });
  }
  return nodes.length > 0 ? { nodes } : null;
}

const FENCE_RE = /```(?:story-graph|json)\s*([\s\S]*?)```/gi;

export function parseStoryGraphJson(text: string): StoryGraph | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fences = [...trimmed.matchAll(FENCE_RE)];
  for (let i = fences.length - 1; i >= 0; i -= 1) {
    const body = fences[i]?.[1]?.trim();
    if (!body) continue;
    try {
      const parsed = JSON.parse(body) as unknown;
      const graph = readGraphPayload(parsed);
      if (graph) return graph;
    } catch {
      continue;
    }
  }

  if (trimmed.startsWith("{")) {
    try {
      return readGraphPayload(JSON.parse(trimmed) as unknown);
    } catch {
      return null;
    }
  }
  return null;
}

export function stripStoryGraphFence(text: string): string {
  return text.replace(FENCE_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}
