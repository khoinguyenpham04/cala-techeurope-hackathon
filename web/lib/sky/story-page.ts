/**
 * Satellite report: seed from catalog + Cala overlay/dossier, then merge
 * optional agent `story-page` JSON. The UI is two identity/report cards plus
 * a feed of story cards. Empty-Cala dumps never become the card-2 lesson.
 */

import { EMPTY_CALA_MESSAGE, type SatelliteDossier, type SourcedField } from "@/lib/cala";
import { constellationFromName } from "@/lib/orbit/constellation";
import type { SatelliteOverlay } from "@/lib/orbit/types";
import {
  isDebrisName,
  shortOperatorName,
  visualForSatellite,
  type ReportVisual,
} from "@/lib/sky/report-visual";
import {
  parseStoryGraphJson,
  type StoryGraph,
  type StoryProvenance,
  type StorySource,
} from "@/lib/sky/story-graph";

export type { StorySource } from "@/lib/sky/story-graph";
export type { ReportVisual } from "@/lib/sky/report-visual";

export const STORY_PAGE_FENCE = "story-page";
export const QUESTION_CARD_FENCE = "question-card";
export const STORY_CARD_FENCE = "story-card";

export type StoryPhase = "thinking" | "searching" | "designing" | "ready";
export type StoryTemplate = "purpose" | "timeline" | "mission";
export type StoryChatStatus = "submitted" | "streaming" | "ready" | "error";

export type StoryCard = {
  id: string;
  phase: StoryPhase;
  template: StoryTemplate;
  question: string;
  headline?: string;
  dek?: string;
  why?: string;
  events?: { year: string; title: string; body?: string }[];
  beats?: { title: string; body: string }[];
  facts?: { label: string; value: string }[];
  images?: { src: string; alt: string; credit?: string; sourceUrl?: string }[];
  sources?: { name: string; url: string }[];
  nextQuestions?: string[];
  kind: "cala" | "web";
  sourcesUnavailable?: boolean;
};

export type CalloutTone = "verified" | "unverified" | "catalog";
export type StoryChipTone = "verified" | "catalog" | "unverified" | "debris" | "muted";

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

export interface StoryChip {
  id: string;
  label: string;
  tone: StoryChipTone;
}

export interface StoryFact {
  id: string;
  label: string;
  value: string;
  known: boolean;
  tone: CalloutTone;
  sources?: StorySource[];
}

export interface StoryIdentity {
  name: string;
  noradId: string;
  constellation?: string;
  blurb: string;
  chips: StoryChip[];
  sources: StorySource[];
  visual: ReportVisual;
}

export interface QuestionCardImage {
  src: string;
  alt: string;
  credit?: string;
  sourceUrl?: string;
}

export interface QuestionCard {
  id: string;
  question: string;
  answer: string;
  images: QuestionCardImage[];
  sources: StorySource[];
  kind: "cala" | "web";
  sourcesUnavailable: boolean;
  streaming?: boolean;
}

export interface StoryPage {
  title: string;
  noradId?: string;
  identity: StoryIdentity | null;
  facts: StoryFact[];
  extraBlocks: StoryBlock[];
  /** Kept so the unused Lexical editor still compiles. Not rendered as soup. */
  blocks: StoryBlock[];
  lessonMarkdown: string | null;
  lessonStreaming: boolean;
  questionCards: QuestionCard[];
  storyCards: StoryCard[];
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

const FACT_SPECS = [
  { id: SEED_BLOCK_IDS.operator, label: "Organization" },
  { id: SEED_BLOCK_IDS.parent, label: "Parent" },
  { id: SEED_BLOCK_IDS.country, label: "Country" },
  { id: SEED_BLOCK_IDS.purpose, label: "Purpose" },
] as const;

const SKIP_EXTRA_IDS = new Set<string>([
  SEED_BLOCK_IDS.title,
  SEED_BLOCK_IDS.identity,
  SEED_BLOCK_IDS.constellation,
  SEED_BLOCK_IDS.who,
  SEED_BLOCK_IDS.operator,
  SEED_BLOCK_IDS.why,
  SEED_BLOCK_IDS.parent,
  SEED_BLOCK_IDS.countryHeading,
  SEED_BLOCK_IDS.country,
  SEED_BLOCK_IDS.purposeHeading,
  SEED_BLOCK_IDS.purpose,
  SEED_BLOCK_IDS.lesson,
]);

type Claim = {
  value: string;
  known: boolean;
  provenance: StoryProvenance;
  evidenceState?: "verified" | "partial" | "unknown";
  sources?: StorySource[];
};

const PAGE_FENCE_RE = /```(?:story-page|story-graph|json)\s*([\s\S]*?)```/gi;
const QUESTION_FENCE_RE = /```question-card\s*([\s\S]*?)```/gi;
const CARD_FENCE_PATTERN = "```(story-card|question-card)\\s*([\\s\\S]*?)```";
const TEMPLATES = new Set<StoryTemplate>(["purpose", "timeline", "mission"]);

function cardFenceRe(): RegExp {
  return new RegExp(CARD_FENCE_PATTERN, "gi");
}
const EMPTY_CALA_RE = /^no verified cala data found\.?$/i;

const TONES = new Set<CalloutTone>(["verified", "unverified", "catalog"]);

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function catalogUrl(noradId: string): StorySource {
  return {
    name: "CelesTrak",
    url: `https://celestrak.org/NORAD/elements/gp.php?CATNR=${encodeURIComponent(noradId)}&FORMAT=JSON`,
  };
}

/**
 * Cala-backed claim, catalog/wiki seed with a value, or unverified empty.
 * Seeded briefs are labeled catalog — never as live Cala verification.
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

  if (seeded && trimmed) {
    return {
      value: trimmed,
      known: true,
      provenance: "catalog",
      evidenceState: "unknown",
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

function sanitizeTone(tone: CalloutTone, sources?: StorySource[]): CalloutTone {
  if (tone === "verified" && !sources?.some((source) => source.url)) {
    return "unverified";
  }
  return tone;
}

function claimCallout(
  id: string,
  title: string,
  emptyBody: string,
  claim: Claim,
): StoryBlock {
  const tone = toneForClaim(claim);
  const known = Boolean(claim.known && claim.value);
  return {
    id,
    type: "callout",
    tone: known ? tone : "unverified",
    title,
    body: known ? claim.value : emptyBody,
    sources: known ? claim.sources : undefined,
  };
}

function heading(id: string, level: 1 | 2 | 3, text: string): StoryBlock {
  return { id, type: "heading", level, text };
}

export function stripStoryPageFence(text: string): string {
  return text
    .replace(PAGE_FENCE_RE, "")
    .replace(cardFenceRe(), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isEmptyCalaDump(text: string | null | undefined): boolean {
  const stripped = text ? stripStoryPageFence(text) : "";
  if (!stripped) return false;
  return stripped === EMPTY_CALA_MESSAGE || EMPTY_CALA_RE.test(stripped);
}

export function lessonFromAgentText(text: string | null | undefined): string | null {
  if (!text) return null;
  const stripped = stripStoryPageFence(text);
  if (!stripped || isEmptyCalaDump(stripped)) return null;
  return stripped;
}

function readImages(value: unknown): QuestionCardImage[] {
  if (!Array.isArray(value)) return [];
  const images: QuestionCardImage[] = [];
  const seen = new Set<string>();
  for (const entry of value.slice(0, 6)) {
    if (typeof entry === "string") {
      const src = entry.trim();
      if (!src || seen.has(src)) continue;
      seen.add(src);
      images.push({ src, alt: "Related photo", sourceUrl: src });
      continue;
    }
    if (!isRecord(entry)) continue;
    const src = asString(entry.src) ?? asString(entry.url);
    if (!src || seen.has(src)) continue;
    seen.add(src);
    images.push({
      src,
      alt: asString(entry.alt) ?? asString(entry.description) ?? "Related photo",
      credit: asString(entry.credit) ?? asString(entry.publisher),
      sourceUrl: asString(entry.sourceUrl) ?? asString(entry.url) ?? src,
    });
  }
  return images;
}

function readQuestionCard(value: unknown, fallbackId: string): QuestionCard | null {
  if (!isRecord(value)) return null;
  const answer = asString(value.answer) ?? asString(value.body) ?? asString(value.text) ?? "";
  const question = asString(value.question) ?? asString(value.prompt) ?? "";
  const sources = readSources(value.sources) ?? [];
  const images = readImages(value.images);
  const kind = asString(value.kind) === "cala" ? "cala" : "web";
  const sourcesUnavailable =
    value.sourcesUnavailable === true ||
    (sources.length === 0 && (value.unavailable === true || !answer));
  if (!answer && !question && images.length === 0 && sources.length === 0) return null;
  return {
    id: asString(value.id) ?? fallbackId,
    question,
    answer,
    images,
    sources,
    kind,
    sourcesUnavailable,
    streaming: value.streaming === true,
  };
}

export function parseQuestionCards(text: string | null | undefined): QuestionCard[] {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return [];
  const cards: QuestionCard[] = [];
  QUESTION_FENCE_RE.lastIndex = 0;
  const fences = [...trimmed.matchAll(QUESTION_FENCE_RE)];
  for (const [index, match] of fences.entries()) {
    const body = match[1]?.trim();
    if (!body) continue;
    try {
      const card = readQuestionCard(JSON.parse(body) as unknown, `q-${index}`);
      if (card) cards.push(card);
    } catch {
      continue;
    }
  }
  return cards;
}

function readEvents(value: unknown): StoryCard["events"] {
  if (!Array.isArray(value)) return undefined;
  const events: NonNullable<StoryCard["events"]> = [];
  for (const entry of value.slice(0, 6)) {
    if (!isRecord(entry)) continue;
    const year = asString(entry.year) ?? asString(entry.date);
    const title = asString(entry.title) ?? asString(entry.heading);
    if (!year || !title) continue;
    events.push({
      year,
      title,
      body: asString(entry.body) ?? asString(entry.text),
    });
  }
  return events.length > 0 ? events : undefined;
}

function readBeats(value: unknown): StoryCard["beats"] {
  if (!Array.isArray(value)) return undefined;
  const beats: NonNullable<StoryCard["beats"]> = [];
  for (const entry of value.slice(0, 3)) {
    if (!isRecord(entry)) continue;
    const title = asString(entry.title) ?? asString(entry.heading);
    const body = asString(entry.body) ?? asString(entry.text);
    if (!title || !body) continue;
    beats.push({ title, body });
  }
  return beats.length > 0 ? beats : undefined;
}

function readFacts(value: unknown): StoryCard["facts"] {
  if (!Array.isArray(value)) return undefined;
  const facts: NonNullable<StoryCard["facts"]> = [];
  for (const entry of value.slice(0, 4)) {
    if (!isRecord(entry)) continue;
    const label = asString(entry.label) ?? asString(entry.name);
    const factValue = asString(entry.value) ?? asString(entry.body);
    if (!label || !factValue) continue;
    facts.push({ label, value: factValue });
  }
  return facts.length > 0 ? facts : undefined;
}

function readNextQuestions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const questions = value.flatMap((item) => {
    const text = asString(item);
    return text ? [text] : [];
  }).slice(0, 4);
  return questions.length > 0 ? questions : undefined;
}

export function storyCardFromQuestion(card: QuestionCard): StoryCard {
  return {
    id: card.id,
    phase: card.streaming ? "designing" : "ready",
    template: "purpose",
    question: card.question,
    why: card.answer || undefined,
    dek: card.answer || undefined,
    images: card.images.length > 0 ? card.images : undefined,
    sources: card.sources.length > 0 ? card.sources : undefined,
    kind: card.kind,
    sourcesUnavailable: card.sourcesUnavailable,
  };
}

export function questionCardFromStory(card: StoryCard): QuestionCard {
  return {
    id: card.id,
    question: card.question,
    answer: card.why ?? card.dek ?? "",
    images: card.images ?? [],
    sources: card.sources ?? [],
    kind: card.kind,
    sourcesUnavailable: Boolean(card.sourcesUnavailable),
    streaming: card.phase !== "ready",
  };
}

function readStoryCard(value: unknown, fallbackId: string): StoryCard | null {
  if (!isRecord(value)) return null;
  const templateRaw = asString(value.template);
  const template: StoryTemplate =
    templateRaw && TEMPLATES.has(templateRaw as StoryTemplate)
      ? (templateRaw as StoryTemplate)
      : "purpose";
  const question = asString(value.question) ?? asString(value.prompt) ?? "";
  const headline = asString(value.headline) ?? asString(value.title);
  const dek = asString(value.dek) ?? asString(value.summary);
  const why = asString(value.why) ?? asString(value.answer);
  const images = readImages(value.images);
  const sources = readSources(value.sources) ?? [];
  const events = readEvents(value.events);
  const beats = readBeats(value.beats);
  const facts = readFacts(value.facts);
  const nextQuestions = readNextQuestions(value.nextQuestions);
  const kind = asString(value.kind) === "cala" ? "cala" : "web";
  const sourcesUnavailable =
    value.sourcesUnavailable === true ||
    (sources.length === 0 && value.unavailable === true);
  if (
    !question &&
    !headline &&
    !dek &&
    !why &&
    images.length === 0 &&
    sources.length === 0 &&
    !events &&
    !beats &&
    !facts
  ) {
    return null;
  }
  return {
    id: asString(value.id) ?? fallbackId,
    phase: "ready",
    template,
    question,
    headline,
    dek,
    why,
    events,
    beats,
    facts,
    images: images.length > 0 ? images : undefined,
    sources: sources.length > 0 ? sources : undefined,
    nextQuestions,
    kind,
    sourcesUnavailable,
  };
}

export function parseStoryCards(text: string | null | undefined): StoryCard[] {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return [];
  const cards: StoryCard[] = [];
  const fences = [...trimmed.matchAll(cardFenceRe())];
  for (const [index, match] of fences.entries()) {
    const fence = match[1];
    const body = match[2]?.trim();
    if (!body) continue;
    try {
      const parsed = JSON.parse(body) as unknown;
      const card =
        fence === "question-card"
          ? (() => {
              const legacy = readQuestionCard(parsed, `q-${index}`);
              return legacy ? storyCardFromQuestion(legacy) : null;
            })()
          : readStoryCard(parsed, `q-${index}`);
      if (card) cards.push(card);
    } catch {
      continue;
    }
  }
  return cards;
}

export function storyPhaseFromChat(input: {
  status?: StoryChatStatus;
  streaming?: boolean;
  hasToolCall?: boolean;
  hasAssistantText?: boolean;
  hasFence?: boolean;
}): StoryPhase {
  if (input.hasFence) return "ready";
  const status =
    input.status ?? (input.streaming ? "streaming" : "ready");
  if (status === "streaming" && input.hasAssistantText) return "designing";
  if (status === "streaming" && input.hasToolCall) return "searching";
  return "thinking";
}

export function collectStoryPageExtras(texts: (string | null | undefined)[]): StoryBlock[] {
  let extras: StoryBlock[] = [];
  for (const text of texts) {
    if (!text) continue;
    const parsed = parseStoryPageJson(text);
    if (parsed) extras = mergeBlocks(extras, parsed);
  }
  return extras;
}

export function storyCardsFromTurns(input: {
  turns: { role: "user" | "assistant"; text: string }[];
  status?: StoryChatStatus;
  streaming?: boolean;
  hasToolCall?: boolean;
}): StoryCard[] {
  const cards: StoryCard[] = [];
  let pendingQuestion: string | null = null;
  let pendingAssistantText = false;
  let index = 0;
  const working =
    input.status === "submitted" ||
    input.status === "streaming" ||
    Boolean(input.streaming);

  for (const turn of input.turns) {
    if (turn.role === "user") {
      pendingQuestion = turn.text.trim();
      pendingAssistantText = false;
      continue;
    }
    const parsed = parseStoryCards(turn.text);
    if (parsed.length > 0) {
      for (const card of parsed) {
        cards.push({
          ...card,
          id: card.id || `q-${index}`,
          question: card.question || pendingQuestion || "Question",
          phase: "ready",
        });
        index += 1;
      }
      pendingQuestion = null;
      pendingAssistantText = false;
      continue;
    }
    pendingAssistantText = Boolean(turn.text.trim());
    if (pendingQuestion && !working) {
      if (isEmptyCalaDump(turn.text)) {
        cards.push({
          id: `q-${index}`,
          phase: "ready",
          template: "purpose",
          question: pendingQuestion,
          why: "Sources unavailable",
          dek: "Sources unavailable",
          kind: "web",
          sourcesUnavailable: true,
        });
        index += 1;
        pendingQuestion = null;
        pendingAssistantText = false;
      } else {
        const leftover = lessonFromAgentText(turn.text);
        if (leftover) {
          cards.push({
            id: `q-${index}`,
            phase: "ready",
            template: "purpose",
            question: pendingQuestion,
            why: leftover,
            dek: leftover,
            kind: "web",
          });
          index += 1;
          pendingQuestion = null;
          pendingAssistantText = false;
        }
      }
    }
  }

  if (pendingQuestion && working) {
    cards.push({
      id: `q-${index}`,
      phase: storyPhaseFromChat({
        status: input.status,
        streaming: input.streaming,
        hasToolCall: input.hasToolCall,
        hasAssistantText: pendingAssistantText,
        hasFence: false,
      }),
      template: "purpose",
      question: pendingQuestion,
      kind: "web",
    });
  }
  return cards;
}

export function questionCardsFromTurns(input: {
  turns: { role: "user" | "assistant"; text: string }[];
  streaming?: boolean;
  status?: StoryChatStatus;
  hasToolCall?: boolean;
}): QuestionCard[] {
  return storyCardsFromTurns(input).map(questionCardFromStory);
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

function readFieldPatch(value: unknown): { body: string; tone?: CalloutTone; sources?: StorySource[] } | null {
  if (typeof value === "string") {
    const body = value.trim();
    return body ? { body } : null;
  }
  if (!isRecord(value)) return null;
  const body = asString(value.value) ?? asString(value.body) ?? asString(value.text);
  if (!body) return null;
  const toneRaw = asString(value.tone);
  const provenance = asString(value.provenance);
  const sources = readSources(value.sources);
  const tone: CalloutTone | undefined =
    toneRaw && TONES.has(toneRaw as CalloutTone)
      ? (toneRaw as CalloutTone)
      : provenance === "cala"
        ? "verified"
        : provenance === "catalog"
          ? "catalog"
          : provenance === "unverified"
            ? "unverified"
            : undefined;
  return { body, tone, sources };
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
    const sources = readSources(entry.sources);
    const tone: CalloutTone = sanitizeTone(
      toneRaw && TONES.has(toneRaw as CalloutTone)
        ? (toneRaw as CalloutTone)
        : provenance === "cala"
          ? "verified"
          : provenance === "catalog"
            ? "catalog"
            : "unverified",
      sources,
    );
    const body = asString(entry.body) ?? asString(entry.value) ?? "";
    const title = asString(entry.title) ?? "Note";
    if (tone === "unverified" && !body && !asString(entry.title)) return null;
    return {
      id,
      type: "callout",
      tone,
      title,
      body,
      sources,
      streaming: entry.streaming === true,
    };
  }
  return null;
}

const FLAT_FIELD_MAP: Array<{ key: string; id: string; title: string }> = [
  { key: "operator", id: SEED_BLOCK_IDS.operator, title: "Organization" },
  { key: "parent", id: SEED_BLOCK_IDS.parent, title: "Parent" },
  { key: "ultimateParent", id: SEED_BLOCK_IDS.parent, title: "Parent" },
  { key: "country", id: SEED_BLOCK_IDS.country, title: "Country" },
  { key: "purpose", id: SEED_BLOCK_IDS.purpose, title: "Purpose" },
  { key: "identity", id: SEED_BLOCK_IDS.identity, title: "About" },
  { key: "blurb", id: SEED_BLOCK_IDS.identity, title: "About" },
  { key: "constellation", id: SEED_BLOCK_IDS.constellation, title: "Constellation" },
];

function blocksFromFlatPayload(value: Record<string, unknown>): StoryBlock[] {
  const blocks: StoryBlock[] = [];
  const seen = new Set<string>();
  for (const field of FLAT_FIELD_MAP) {
    if (seen.has(field.id)) continue;
    const patch = readFieldPatch(value[field.key]);
    if (!patch) continue;
    seen.add(field.id);
    const sources = patch.sources;
    const tone = sanitizeTone(patch.tone ?? (sources?.length ? "verified" : "catalog"), sources);
    blocks.push({
      id: field.id,
      type: "callout",
      tone,
      title: field.title,
      body: patch.body,
      sources,
    });
  }
  return blocks;
}

function readPagePayload(value: unknown): StoryBlock[] | null {
  if (!isRecord(value)) return null;
  const raw = Array.isArray(value.blocks) ? value.blocks : null;
  const fromBlocks: StoryBlock[] = [];
  if (raw) {
    for (const [index, entry] of raw.slice(0, 40).entries()) {
      const block = readBlock(entry, index);
      if (block) fromBlocks.push(block);
    }
  }
  const fromFlat = blocksFromFlatPayload(value);
  if (fromBlocks.length === 0 && fromFlat.length === 0) return null;
  return mergeBlocks(fromBlocks, fromFlat.length > 0 ? fromFlat : null);
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
      const previous = byId.get(block.id)!;
      byId.set(block.id, { ...previous, ...block, id: block.id });
    } else {
      extras.push(block);
    }
  }
  return [...byId.values(), ...extras];
}

function calloutById(blocks: StoryBlock[], id: string): Extract<StoryBlock, { type: "callout" }> | undefined {
  const block = blocks.find((entry) => entry.id === id);
  return block?.type === "callout" ? block : undefined;
}

function uniqueSources(sources: StorySource[]): StorySource[] {
  const seen = new Set<string>();
  const out: StorySource[] = [];
  for (const source of sources) {
    if (!source.url) continue;
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    out.push(source);
  }
  return out;
}

function factsFromBlocks(blocks: StoryBlock[]): StoryFact[] {
  return FACT_SPECS.map((spec) => {
    const callout = calloutById(blocks, spec.id);
    const known = Boolean(callout && callout.tone !== "unverified" && callout.body.trim());
    return {
      id: spec.id,
      label: spec.label,
      value: known ? callout!.body : "",
      known,
      tone: callout?.tone ?? "unverified",
      sources: known ? callout?.sources : undefined,
    };
  });
}

function chipsFor(input: {
  name: string;
  constellation?: string;
  facts: StoryFact[];
  calaVerified: boolean;
}): StoryChip[] {
  const chips: StoryChip[] = [
    { id: "catalog", label: "Catalog", tone: "catalog" },
  ];
  if (input.calaVerified) {
    chips.push({ id: "cala", label: "Cala verified", tone: "verified" });
  }
  if (isDebrisName(input.name)) {
    chips.push({ id: "debris", label: "Debris", tone: "debris" });
  }
  const country = input.facts.find((fact) => fact.id === SEED_BLOCK_IDS.country);
  if (country?.known && country.value) {
    chips.push({ id: "country", label: country.value, tone: "muted" });
  }
  const operator = input.facts.find((fact) => fact.id === SEED_BLOCK_IDS.operator);
  if (operator?.known && operator.value) {
    chips.push({
      id: "operator",
      label: shortOperatorName(operator.value),
      tone: "muted",
    });
  } else if (input.constellation) {
    chips.push({ id: "family", label: input.constellation, tone: "muted" });
  }
  return chips;
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
        text: "Click a payload on the globe to open its report. Catalog briefs fill from public sources; Cala can add cited ownership when it is reachable.",
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
  const blurb = overlay?.blurb?.trim();
  const identitySources = uniqueSources([
    ...(overlay?.sources?.filter((source) => source.url) ?? []),
    catalog,
  ]);

  const blocks: StoryBlock[] = [
    heading(SEED_BLOCK_IDS.title, 1, satellite.name),
    {
      id: SEED_BLOCK_IDS.identity,
      type: "callout",
      tone: "catalog",
      title: "About",
      body:
        blurb ??
        `NORAD ${satellite.noradId}. Local CelesTrak GP identity. Organization notes below are public-source briefs, not live Cala verification.`,
      sources: identitySources,
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
    claimCallout(
      SEED_BLOCK_IDS.operator,
      "Organization",
      "No organization in the local brief",
      operator,
    ),
    claimCallout(
      SEED_BLOCK_IDS.parent,
      "Parent",
      "No parent in the local brief",
      parent,
    ),
    claimCallout(
      SEED_BLOCK_IDS.country,
      "Country",
      "No country in the local brief",
      country,
    ),
    claimCallout(
      SEED_BLOCK_IDS.purpose,
      "Purpose",
      "No purpose in the local brief",
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
  questionCards?: QuestionCard[] | null;
  storyCards?: StoryCard[] | null;
}): StoryPage {
  const rawLesson = input.lessonText?.trim() ?? "";
  const extra = input.extra ?? (rawLesson ? parseStoryPageJson(rawLesson) : null);
  const lessonMarkdown = lessonFromAgentText(rawLesson) ?? "";
  const blocks = mergeBlocks(seedStoryPage(input), extra);
  const facts = factsFromBlocks(blocks);
  const calaVerified = facts.some((fact) => fact.known && fact.tone === "verified");
  const constellation =
    calloutById(blocks, SEED_BLOCK_IDS.constellation)?.body ??
    (input.satellite ? constellationFromName(input.satellite.name) : undefined);

  const identity: StoryIdentity | null = input.satellite
    ? {
        name: input.satellite.name,
        noradId: input.satellite.noradId,
        constellation,
        blurb: calloutById(blocks, SEED_BLOCK_IDS.identity)?.body ?? "",
        chips: chipsFor({
          name: input.satellite.name,
          constellation,
          facts,
          calaVerified,
        }),
        sources: uniqueSources([
          ...(calloutById(blocks, SEED_BLOCK_IDS.identity)?.sources ?? []),
          catalogUrl(input.satellite.noradId),
        ]),
        visual: visualForSatellite(input.satellite.name),
      }
    : null;

  const extraBlocks = blocks
    .filter((block) => !SKIP_EXTRA_IDS.has(block.id))
    .filter((block) => block.type !== "heading")
    .slice(0, 3);

  return {
    title: input.satellite?.name ?? "Satellite",
    noradId: input.satellite?.noradId,
    identity,
    facts,
    extraBlocks,
    blocks,
    lessonMarkdown: lessonMarkdown || null,
    lessonStreaming: Boolean(input.lessonStreaming) && !lessonMarkdown,
    questionCards:
      input.questionCards ??
      (input.storyCards ?? []).map(questionCardFromStory),
    storyCards:
      input.storyCards ??
      (input.questionCards ?? []).map(storyCardFromQuestion),
  };
}
