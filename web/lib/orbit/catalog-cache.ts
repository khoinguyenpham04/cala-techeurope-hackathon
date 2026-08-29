import {
  CATALOG_TTL_MS,
  CELESTRAK_ACTIVE_OMM_URL,
  CELESTRAK_BLOCK_MS,
  CELESTRAK_TRANSIENT_BACKOFF_MS,
} from "@/lib/orbit/constants";
import { parseOmmCatalog } from "@/lib/orbit/omm";
import type { CatalogSource, OrbitCatalogResponse, SlimOmm } from "@/lib/orbit/types";

interface Snapshot {
  records: SlimOmm[];
  fetchedAt: number;
  dropped: number;
}

let lastGood: Snapshot | null = null;
let cachedUntil = 0;
let blockedUntil = 0;
let inFlight: Promise<OrbitCatalogResponse> | null = null;

function toResponse(
  snapshot: Snapshot,
  source: CatalogSource,
  stale: boolean,
  error?: string,
): OrbitCatalogResponse {
  return {
    records: snapshot.records,
    fetchedAt: new Date(snapshot.fetchedAt).toISOString(),
    cachedUntil: new Date(cachedUntil).toISOString(),
    source,
    stale,
    dropped: snapshot.dropped,
    error,
  };
}

function emptyError(message: string): OrbitCatalogResponse {
  return {
    records: [],
    fetchedAt: lastGood ? new Date(lastGood.fetchedAt).toISOString() : null,
    cachedUntil: cachedUntil ? new Date(cachedUntil).toISOString() : null,
    source: "stale",
    stale: true,
    dropped: 0,
    error: message,
  };
}

async function downloadCatalog(): Promise<
  | { ok: true; snapshot: Snapshot }
  | { ok: false; kind: "http"; status: number }
  | { ok: false; kind: "transient"; message: string }
> {
  try {
    const response = await fetch(CELESTRAK_ACTIVE_OMM_URL, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "SkyConsole/0.1 (TechEurope x Cala hackathon)",
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (response.status !== 200) {
      return { ok: false, kind: "http", status: response.status };
    }
    const payload: unknown = await response.json();
    const { records, dropped } = parseOmmCatalog(payload);
    if (records.length === 0) {
      return {
        ok: false,
        kind: "transient",
        message: "CelesTrak returned no valid OMM records.",
      };
    }
    return {
      ok: true,
      snapshot: { records, fetchedAt: Date.now(), dropped },
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "CelesTrak request failed.";
    return { ok: false, kind: "transient", message };
  }
}

async function refresh(now: number): Promise<OrbitCatalogResponse> {
  const result = await downloadCatalog();
  if (result.ok) {
    lastGood = result.snapshot;
    cachedUntil = now + CATALOG_TTL_MS;
    blockedUntil = 0;
    return toResponse(result.snapshot, "live", false);
  }
  if (result.kind === "http") {
    blockedUntil = now + CELESTRAK_BLOCK_MS;
    if (lastGood) {
      return toResponse(
        lastGood,
        "stale",
        true,
        `CelesTrak returned HTTP ${result.status}; serving last snapshot. Not retrying until ${new Date(blockedUntil).toISOString()}.`,
      );
    }
    return emptyError(
      `CelesTrak returned HTTP ${result.status}. No cached snapshot is available.`,
    );
  }
  cachedUntil = now + CELESTRAK_TRANSIENT_BACKOFF_MS;
  if (lastGood) {
    return toResponse(lastGood, "stale", true, result.message);
  }
  return emptyError(result.message);
}

export async function getOrbitCatalog(now = Date.now()): Promise<OrbitCatalogResponse> {
  if (lastGood && now < cachedUntil) {
    return toResponse(lastGood, "cache", false);
  }
  if (now < blockedUntil) {
    if (lastGood) {
      return toResponse(
        lastGood,
        "stale",
        true,
        "CelesTrak previously returned a non-200 response; serving last snapshot.",
      );
    }
    return emptyError("CelesTrak previously returned a non-200 response; not retrying yet.");
  }
  if (inFlight) return inFlight;
  inFlight = refresh(now).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Test seam — do not use from UI. */
export function resetOrbitCatalogCache() {
  lastGood = null;
  cachedUntil = 0;
  blockedUntil = 0;
  inFlight = null;
}

export function seedOrbitCatalogCache(snapshot: Snapshot, ttlMs = CATALOG_TTL_MS) {
  lastGood = snapshot;
  cachedUntil = snapshot.fetchedAt + ttlMs;
  blockedUntil = 0;
}
