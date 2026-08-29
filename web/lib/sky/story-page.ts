/**
 * Notion-like satellite page: seed from catalog + Cala overlay/dossier, then
 * merge optional agent `story-page` (or legacy `story-graph`) JSON. Lesson
 * markdown is appended as Lexical blocks — never as a flowchart.
 */

import type { SatelliteDossier, SourcedField } from "@/lib/cala";
import { constellationFromName } from "@/lib/orbit/constellation";
import type { SatelliteOverlay } from "@/lib/orbit/types";
import {
  parseStoryGraphJson,
  type StoryGraph,
  type StoryProvenance,
  type StorySource,
} from "@/lib/sky/story-graph";

export type { StorySource } from "@/lib/sky/story-graph";

export const STORY_PAGE_FENCE = "story-page";

export type CalloutTone = "verified" | "unverified" | "catalog";

export interface StoryObjectIdentity {
  noradId: string;
  name: string;
}

export type StoryBlock =
  | { id: string; type: "heading"; level: 1 | 2 | 3; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "quote"; text: string }
  | { id: string; type: "list"; ordered?: boolean; items: string[] }
  | {
      id: string;
      type: "callout";
      tone: CalloutTone;
      title: string;
      body: string;
      sources?: StorySource[];
      streaming?: boolean;
    };

export interface StoryPage {
  title: string;
  noradId?: string;
  blocks: StoryBlock[];
  lessonMarkdown: string | null;
  lessonStreaming: boolean;
}

export const SEED_BLOCK_IDS = {
  title: "title",
  identity: "identity",
  constellation: "constellation",
  who: "who",
  operator: "operator",
  why: "why",
  parent: "parent",
  countryHeading: "country-heading",
  country: "country",
  purposeHeading: "purpose-heading",
  purpose: "purpose",
  lesson: "lesson",
} as const;

type Claim = {
  value: string;
  known: boolean;
  provenance: StoryProvenance;
  evidenceState?: "verified" | "partial" | "unknown";
  sources?: StorySource[];
};

const PAGE_FENCE_RE = /```(?:story-page|story-graph|json)\s*([\s\S]*?)```/gi;

const TONES = new Set<CalloutTone>(["verified", "unverified", "catalog"]);

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function catalogUrl(noradId: string): StorySource {
  return {
    name: "CelesTrak GP (OMM)",
    url: `https://celestrak.org/NORAD/elements/gp.php?CATNR=${encodeURIComponent(noradId)}&FORMAT=JSON`,
  };
}

/**
 * Cala-backed claim, or unverified empty. Catalog seed paint (`seeded: true`)
 * is not a sourced operator/parent/country/purpose — never surface it as a fact.
 */
function claimFromField(
  overlayValue: string | null | undefined,
  overlay: SatelliteOverlay | undefined,
  dossierField?: SourcedField,
): Claim {
  if (dossierField?.value) {
    const sources = dossierField.sources.filter((source) => source.url);
    return {
      value: dossierField.value,
      known: sources.length > 0,
      provenance: sources.length > 0 ? "cala" : "unverified",
      evidenceState:
        overlay?.evidenceState ?? (sources.length > 0 ? "partial" : "unknown"),
      sources,
    };
  }

  const trimmed = overlayValue?.trim();
  const overlaySources = overlay?.sources?.filter((source) => source.url) ?? [];
  const seeded = overlay?.seeded === true;
  const calaReady =
    !seeded &&
    Boolean(trimmed) &&
    (overlay?.evidenceState === "verified" ||
      overlay?.evidenceState === "partial" ||
      overlaySources.length > 0);

  if (calaReady && trimmed) {
    return {
      value: trimmed,
      known: true,
      provenance: "cala",
      evidenceState: overlay?.evidenceState ?? "partial",
      sources: overlaySources,
    };
  }

  return {
    value: "",
    known: false,
    provenance: "unverified",
    evidenceState: "unknown",
  };
}

function toneForClaim(claim: Claim): CalloutTone {
  if (claim.provenance === "cala" && claim.known) return "verified";
  if (claim.provenance === "catalog") return "catalog";
  return "unverified";
}

function claimCallout(
  id: string,
  title: string,
  emptyBody: string,
  claim: Claim,
): StoryBlock {
  const verified = toneForClaim(claim) === "verified";
  return {
    id,
    type: "callout",
    tone: verified ? "verified" : "unverified",
    title,
    body: verified ? claim.value : emptyBody,
    sources: verified ? claim.sources : undefined,
  };
}

function heading(id: string, level: 1 | 2 | 3, text: string): StoryBlock {
  return { id, type: "heading", level, text };
}

export function stripStoryPageFence(text: string): string {
  return text.replace(PAGE_FENCE_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}

function readSources(value: unknown): StorySource[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sources: StorySource[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const url = asString(entry.url);
    const name = asString(entry.name) ?? url;
    if (!name && !url) continue;
    const key = url || name || "";
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      name: name || "Cala source",
      url: url ?? "",
      date: asString(entry.date) ?? null,
    });
  }
  return sources.length > 0 ? sources : undefined;
}

function readBlock(entry: unknown, index: number): StoryBlock | null {
  if (!isRecord(entry)) return null;
  const id = asString(entry.id) ?? `extra-${index}`;
  const type = asString(entry.type);

  if (type === "heading") {
    const levelRaw = entry.level;
    const level: 1 | 2 | 3 =
      levelRaw === 1 || levelRaw === 2 || levelRaw === 3 ? levelRaw : 2;
    return heading(id, level, asString(entry.text) ?? asString(entry.body) ?? "Untitled");
  }
  if (type === "paragraph") {
    const text = asString(entry.text) ?? asString(entry.body);
    if (!text) return null;
    return { id, type: "paragraph", text };
  }
  if (type === "quote") {
    const text = asString(entry.text) ?? asString(entry.body);
    if (!text) return null;
    return { id, type: "quote", text };
  }
  if (type === "list") {
    const items = Array.isArray(entry.items)
      ? entry.items.flatMap((item) => {
          const text = asString(item);
          return text ? [text] : [];
        })
      : [];
    if (items.length === 0) return null;
    return {
      id,
      type: "list",
      ordered: entry.ordered === true,
      items: items.slice(0, 24),
    };
  }
  if (type === "callout" || type === "entity" || !type) {
    const toneRaw = asString(entry.tone);
    const provenance = asString(entry.provenance);
    const tone: CalloutTone =
      toneRaw && TONES.has(toneRaw as CalloutTone)
        ? (toneRaw as CalloutTone)
        : provenance === "cala"
          ? "verified"
          : provenance === "catalog"
            ? "catalog"
            : "unverified";
    const body = asString(entry.body) ?? asString(entry.value) ?? "";
    const title = asString(entry.title) ?? "Note";
    if (tone === "unverified" && !body && !asString(entry.title)) return null;
    return {
      id,
      type: "callout",
      tone,
      title,
      body,
      sources: readSources(entry.sources),
      streaming: entry.streaming === true,
    };
  }
  return null;
}

function readPagePayload(value: unknown): StoryBlock[] | null {
  if (!isRecord(value)) return null;
  const raw = Array.isArray(value.blocks) ? value.blocks : null;
  if (!raw || raw.length === 0) return null;
  const blocks: StoryBlock[] = [];
  for (const [index, entry] of raw.slice(0, 40).entries()) {
    const block = readBlock(entry, index);
    if (block) blocks.push(block);
  }
  return blocks.length > 0 ? blocks : null;
}

function toneFromProvenance(provenance: StoryProvenance): CalloutTone {
  if (provenance === "cala") return "verified";
  if (provenance === "catalog") return "catalog";
  return "unverified";
}

export function blocksFromStoryGraph(graph: StoryGraph): StoryBlock[] {
  const blocks: StoryBlock[] = [];
  const skip = new Set(["object", "plan", "lesson", "sources"]);
  for (const node of graph.nodes) {
    if (skip.has(node.id) || node.data.kind === "plan" || node.data.kind === "lesson") {
      continue;
    }
    const tone = toneFromProvenance(node.data.provenance);
    const empty =
      tone === "unverified" && !node.data.known
        ? `No verified ${node.data.title.toLowerCase()}`
        : node.data.value;
    blocks.push({
      id: node.id,
      type: "callout",
      tone,
      title: node.data.title,
      body: tone === "unverified" && !node.data.known ? empty : node.data.value,
      sources: tone === "verified" ? node.data.sources : undefined,
    });
  }
  return blocks;
}

export function parseStoryPageJson(text: string): StoryBlock[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fences = [...trimmed.matchAll(PAGE_FENCE_RE)];
  for (let i = fences.length - 1; i >= 0; i -= 1) {
    const body = fences[i]?.[1]?.trim();
    if (!body) continue;
    try {
      const parsed = JSON.parse(body) as unknown;
      const pageBlocks = readPagePayload(parsed);
      if (pageBlocks) return pageBlocks;
      const graph = parseStoryGraphJson(body) ?? parseStoryGraphJson(trimmed);
      if (graph) {
        const fromGraph = blocksFromStoryGraph(graph);
        if (fromGraph.length > 0) return fromGraph;
      }
    } catch {
      continue;
    }
  }

  const graph = parseStoryGraphJson(trimmed);
  if (graph) {
    const fromGraph = blocksFromStoryGraph(graph);
    if (fromGraph.length > 0) return fromGraph;
  }
  return null;
}

function mergeBlocks(seed: StoryBlock[], extra: StoryBlock[] | null): StoryBlock[] {
  if (!extra || extra.length === 0) return seed;
  const byId = new Map(seed.map((block) => [block.id, block]));
  const extras: StoryBlock[] = [];
  for (const block of extra) {
    if (byId.has(block.id)) {
      byId.set(block.id, { ...byId.get(block.id)!, ...block, id: block.id });
    } else {
      extras.push(block);
    }
  }
  const merged = [...byId.values()];
  const lessonIndex = merged.findIndex((block) => block.id === SEED_BLOCK_IDS.lesson);
  if (lessonIndex >= 0) {
    merged.splice(lessonIndex, 0, ...extras);
    return merged;
  }
  return [...merged, ...extras];
}

export function seedStoryPage(input: {
  satellite: StoryObjectIdentity | null;
  overlay?: SatelliteOverlay;
  dossier?: SatelliteDossier | null;
}): StoryBlock[] {
  const { satellite, overlay, dossier } = input;
  if (!satellite) {
    return [
      heading(SEED_BLOCK_IDS.title, 1, "Select a satellite"),
      {
        id: "empty",
        type: "paragraph",
        text: "Click a payload on the globe to open its page. Operator, parent, country, and purpose stay empty until Cala sources them.",
      },
    ];
  }

  const constellation = constellationFromName(satellite.name);
  const operator = claimFromField(overlay?.operator, overlay, dossier?.operator);
  const parent = claimFromField(
    overlay?.ultimateParent,
    overlay,
    dossier?.ultimateParent,
  );
  const country = claimFromField(overlay?.country, overlay, dossier?.country);
  const purpose = claimFromField(overlay?.purpose, overlay, dossier?.purpose);
  const catalog = catalogUrl(satellite.noradId);

  const blocks: StoryBlock[] = [
    heading(SEED_BLOCK_IDS.title, 1, satellite.name),
    {
      id: SEED_BLOCK_IDS.identity,
      type: "callout",
      tone: "catalog",
      title: "Catalog",
      body: `NORAD ${satellite.noradId}. CelesTrak identity only — not operator, owner, country, or purpose.`,
      sources: [catalog],
    },
  ];

  if (constellation) {
    blocks.push({
      id: SEED_BLOCK_IDS.constellation,
      type: "callout",
      tone: "catalog",
      title: "Constellation",
      body: constellation,
    });
  }

  blocks.push(
    heading(SEED_BLOCK_IDS.who, 2, "Who"),
    claimCallout(
      SEED_BLOCK_IDS.operator,
      "Operator",
      "No verified operator",
      operator,
    ),
    heading(SEED_BLOCK_IDS.why, 2, "Why"),
    claimCallout(
      SEED_BLOCK_IDS.parent,
      "Ultimate parent",
      "No verified ultimate parent",
      parent,
    ),
    heading(SEED_BLOCK_IDS.countryHeading, 2, "Country"),
    claimCallout(
      SEED_BLOCK_IDS.country,
      "Country",
      "No verified country",
      country,
    ),
    heading(SEED_BLOCK_IDS.purposeHeading, 2, "Purpose"),
    claimCallout(
      SEED_BLOCK_IDS.purpose,
      "Purpose",
      "No verified purpose",
      purpose,
    ),
  );

  return blocks;
}

export function buildStoryPage(input: {
  satellite: StoryObjectIdentity | null;
  overlay?: SatelliteOverlay;
  dossier?: SatelliteDossier | null;
  lessonText?: string | null;
  lessonStreaming?: boolean;
  extra?: StoryBlock[] | null;
}): StoryPage {
  const rawLesson = input.lessonText?.trim() ?? "";
  const extra = input.extra ?? (rawLesson ? parseStoryPageJson(rawLesson) : null);
  const lessonMarkdown = rawLesson ? stripStoryPageFence(rawLesson) : "";
  const blocks = mergeBlocks(seedStoryPage(input), extra);

  const showLesson =
    Boolean(lessonMarkdown) || Boolean(input.lessonStreaming);
  if (showLesson) {
    const already = blocks.some((block) => block.id === SEED_BLOCK_IDS.lesson);
    if (!already) {
      blocks.push(heading(SEED_BLOCK_IDS.lesson, 2, "Lesson"));
    }
  }

  return {
    title: input.satellite?.name ?? "Satellite",
    noradId: input.satellite?.noradId,
    blocks,
    lessonMarkdown: lessonMarkdown || null,
    lessonStreaming: Boolean(input.lessonStreaming),
  };
}
