/**
 * Client-side Cala evidence contract and tool-output parsers.
 *
 * The globe should POST visible catalog objects to `/api/satellites/enrich`
 * (rewritten to the Flue server). Never call api.cala.ai from the browser.
 */

import type { FlueConversationMessage } from "@flue/react";

export const EMPTY_CALA_MESSAGE = "No verified Cala data found";
export const NORAD_ID_RE = /^\d{1,9}$/;

export const LOOKUP_SATELLITE_DOSSIER = "lookup_satellite_dossier";
export const CALA_KNOWLEDGE_SEARCH = "cala_knowledge_search";

export type EvidenceState = "verified" | "partial" | "unknown";
export type MatchKind = "satellite" | "constellation" | "operator";

export interface CalaSource {
  name: string;
  url: string;
  date?: string;
}

export interface SourcedField {
  value: string;
  sources: CalaSource[];
}

/** Stable shape the globe consumes for recoloring and the inspector. */
export interface SatelliteDossier {
  noradId: string;
  evidenceState: EvidenceState;
  operator?: SourcedField;
  ultimateParent?: SourcedField;
  country?: SourcedField;
  purpose?: SourcedField;
  sources: CalaSource[];
  colorKey?: string;
  matchKind?: MatchKind;
  entityId?: string;
  entityName?: string;
  celestrakName?: string;
  constellationHint?: string;
  /** Catalog seed paint — not Cala evidence. */
  seeded?: boolean;
}

export interface CatalogObject {
  noradId: string;
  name?: string;
  constellation?: string;
}

export interface EnrichmentHalt {
  code: "timeout" | "rate_limited" | "unreachable" | "unconfigured" | "http";
  message: string;
  retryAfterMs?: number;
}

export interface EnrichmentResponse {
  dossiers: SatelliteDossier[];
  skipped: string[];
  halted?: EnrichmentHalt;
  error?: EnrichmentHalt;
}

export interface CalaCitation {
  title: string;
  url: string;
  publisher?: string;
  date?: string;
  snippet?: string;
}

/** Catalog + Cala facts pack sent on satellite chat start. Not invented. */
export type SatPack = {
  noradId: string;
  name: string;
  constellation?: string;
  city?: string;
  blurb?: string;
  operator?: { value: string; sources: { name: string; url: string }[] };
  parent?: { value: string; sources: { name: string; url: string }[] };
  country?: { value: string; sources: { name: string; url: string }[] };
  purpose?: { value: string; sources: { name: string; url: string }[] };
  image?: { src: string; alt: string; credit: string; sourceUrl?: string };
  evidenceState?: "verified" | "partial" | "unknown";
  seeded?: boolean;
};

export interface SatelliteChatContext {
  noradId: string;
  name?: string;
  constellation?: string;
  city?: string;
  pack?: SatPack;
}

const MAX_ENRICH_SATELLITES = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readSource(value: unknown): CalaSource | undefined {
  if (!isRecord(value)) return undefined;
  const url = asString(value.url) ?? "";
  const name = asString(value.name) ?? url;
  if (!name && !url) return undefined;
  return { name: name || "Cala source", url, date: asString(value.date) };
}

function readSourcedField(value: unknown): SourcedField | undefined {
  if (!isRecord(value)) return undefined;
  const fieldValue = asString(value.value);
  if (!fieldValue) return undefined;
  const sources = Array.isArray(value.sources)
    ? value.sources.flatMap((entry) => {
        const source = readSource(entry);
        return source ? [source] : [];
      })
    : [];
  return { value: fieldValue, sources };
}

export function readDossier(output: unknown): SatelliteDossier | undefined {
  if (!isRecord(output)) return undefined;
  const noradId = asString(output.noradId);
  if (!noradId) return undefined;
  const evidenceState =
    output.evidenceState === "verified" ||
    output.evidenceState === "partial" ||
    output.evidenceState === "unknown"
      ? output.evidenceState
      : "unknown";
  const sources = Array.isArray(output.sources)
    ? output.sources.flatMap((entry) => {
        const source = readSource(entry);
        return source ? [source] : [];
      })
    : [];
  return {
    noradId,
    evidenceState,
    operator: readSourcedField(output.operator),
    ultimateParent: readSourcedField(output.ultimateParent),
    country: readSourcedField(output.country),
    purpose: readSourcedField(output.purpose),
    sources,
    colorKey: asString(output.colorKey),
    matchKind:
      output.matchKind === "satellite" ||
      output.matchKind === "constellation" ||
      output.matchKind === "operator"
        ? output.matchKind
        : undefined,
    entityId: asString(output.entityId),
    entityName: asString(output.entityName),
    celestrakName: asString(output.celestrakName),
    constellationHint: asString(output.constellationHint),
    seeded: output.seeded === true,
  };
}

function citationsFromDossier(dossier: SatelliteDossier): CalaCitation[] {
  return dossier.sources
    .filter((source) => source.url)
    .map((source) => ({
      title: source.name,
      url: source.url,
      publisher: source.name,
      date: source.date,
    }));
}

function citationsFromSearchOutput(output: unknown): CalaCitation[] {
  if (!isRecord(output)) return [];
  const direct = Array.isArray(output.sources)
    ? output.sources.flatMap((entry) => {
        const source = readSource(entry);
        if (!source?.url) return [];
        return [
          {
            title: source.name,
            url: source.url,
            publisher: source.name,
            date: source.date,
          } satisfies CalaCitation,
        ];
      })
    : [];
  if (direct.length > 0) return direct;

  const context = output.context;
  if (!Array.isArray(context)) return [];
  const byUrl = new Map<string, CalaCitation>();
  for (const bit of context) {
    if (!isRecord(bit) || !Array.isArray(bit.origins)) continue;
    for (const origin of bit.origins) {
      if (!isRecord(origin)) continue;
      const document = isRecord(origin.document) ? origin.document : undefined;
      const source = isRecord(origin.source) ? origin.source : undefined;
      const url = asString(document?.url) ?? asString(source?.url);
      if (!url || byUrl.has(url)) continue;
      const publisher = asString(source?.name);
      const title = asString(document?.name) ?? publisher ?? url;
      byUrl.set(url, { title, url, publisher });
    }
  }
  return [...byUrl.values()];
}

/** Every Cala source cited in this assistant turn, de-duplicated by URL. */
export function calaSources(message: FlueConversationMessage): CalaCitation[] {
  const byUrl = new Map<string, CalaCitation>();
  for (const part of message.parts) {
    if (part.type !== "dynamic-tool" || part.state !== "output-available") continue;
    if (part.toolName === LOOKUP_SATELLITE_DOSSIER) {
      const dossier = readDossier(part.output);
      if (!dossier) continue;
      for (const citation of citationsFromDossier(dossier)) {
        if (!byUrl.has(citation.url)) byUrl.set(citation.url, citation);
      }
    }
    if (part.toolName === CALA_KNOWLEDGE_SEARCH) {
      for (const citation of citationsFromSearchOutput(part.output)) {
        if (!byUrl.has(citation.url)) byUrl.set(citation.url, citation);
      }
    }
  }
  return [...byUrl.values()];
}

export function dossierFromMessage(
  message: FlueConversationMessage,
): SatelliteDossier | undefined {
  for (const part of message.parts) {
    if (part.type !== "dynamic-tool" || part.state !== "output-available") continue;
    if (part.toolName !== LOOKUP_SATELLITE_DOSSIER) continue;
    const dossier = readDossier(part.output);
    if (dossier) return dossier;
  }
  return undefined;
}

/**
 * Globe enrichment helper. Send the selected object first (or set
 * `selectedNoradId`) so it is resolved before the rest of the visible set.
 * Retry `skipped` NORAD IDs in a later POST. Grey dots stay grey until a
 * dossier with `evidenceState !== "unknown"` and a `colorKey` arrives.
 * Map results with `overlayFromDossiers` before painting the globe.
 */
export async function enrichSatellites(input: {
  selectedNoradId?: string;
  satellites: CatalogObject[];
}): Promise<EnrichmentResponse> {
  if (input.satellites.length === 0) {
    return { dossiers: [], skipped: [] };
  }
  try {
    const response = await fetch("/api/satellites/enrich", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedNoradId: input.selectedNoradId,
        satellites: input.satellites.slice(0, MAX_ENRICH_SATELLITES),
      }),
    });
    const payload = (await response.json()) as EnrichmentResponse;
    if (response.ok) return payload;
    const halt = payload.halted ?? payload.error ?? haltFromStatus(response.status);
    return {
      dossiers: payload.dossiers ?? [],
      skipped: payload.skipped ?? [],
      halted: halt,
      error: payload.error ?? halt,
    };
  } catch (cause) {
    const halt: EnrichmentHalt = {
      code: "unreachable",
      message:
        cause instanceof Error
          ? cause.message
          : "Cala is unreachable. Ownership enrichment paused.",
    };
    return { dossiers: [], skipped: [], halted: halt, error: halt };
  }
}

function haltFromStatus(status: number): EnrichmentHalt {
  if (status === 429) {
    return { code: "rate_limited", message: "Cala rate limit exceeded (HTTP 429). Ownership enrichment paused." };
  }
  if (status === 504) {
    return { code: "timeout", message: "Cala timed out. Ownership enrichment paused." };
  }
  if (status === 503) {
    return { code: "unconfigured", message: "Cala is not configured. Ownership enrichment paused." };
  }
  return { code: "unreachable", message: `Ownership enrichment paused (HTTP ${status}).` };
}

export async function fetchSatelliteDossier(
  object: CatalogObject,
): Promise<SatelliteDossier> {
  const params = new URLSearchParams();
  if (object.name) params.set("name", object.name);
  if (object.constellation) params.set("constellation", object.constellation);
  const query = params.toString();
  const response = await fetch(
    `/api/satellites/${encodeURIComponent(object.noradId)}${query ? `?${query}` : ""}`,
  );
  const payload = (await response.json()) as {
    dossier?: SatelliteDossier;
    error?: EnrichmentHalt;
  };
  if (!response.ok || !payload.dossier) {
    throw new Error(payload.error?.message ?? `Dossier failed (${response.status})`);
  }
  return payload.dossier;
}

export function agentUrlForSession(sessionId: string, kind?: "assistant" | "satellite"): string {
  const satellite = kind === "satellite" || sessionId.startsWith("sat-");
  return satellite ? `/api/agents/satellite/${sessionId}` : `/api/agents/assistant/${sessionId}`;
}

