import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CATALOG_TTL_MS,
  CELESTRAK_ACTIVE_OMM_URL,
  CELESTRAK_BLOCK_MS,
  CELESTRAK_STALE_MESSAGE,
  CELESTRAK_TRANSIENT_BACKOFF_MS,
} from "@/lib/orbit/constants";
import { parseOmmCatalog } from "@/lib/orbit/omm";
import { policyBlockMs } from "@/lib/orbit/retry-after";
import demoOmm from "@/lib/orbit/seed/demo-omm.json";
import type { CatalogSource, OrbitCatalogResponse, SlimOmm } from "@/lib/orbit/types";

const SNAPSHOT_VERSION = 1;
const SEED_FETCHED_AT = Date.parse("2026-08-29T00:00:00.000Z");

/**
 * Why the HUD says "Cached":
 * CelesTrak often returns non-200 (typically 403). Policy is no retry for
 * `CELESTRAK_BLOCK_MS` (~2h). Until then we serve `lastGood` (disk snapshot of
 * a previous live download) or the bundled seed at
 * `web/lib/orbit/seed/demo-omm.json`. That fallback is why the client shows
 * Cached — it is not a successful live GP download.
 */

interface Snapshot {
  records: SlimOmm[];
  fetchedAt: number;
  dropped: number;
  origin: "live" | "seed";
}

interface DiskSnapshot {
  version: number;
  records: SlimOmm[];
  fetchedAt: number;
  dropped: number;
  cachedUntil: number;
  blockedUntil: number;
}

let diskPath = path.join(process.cwd(), ".cache", "celestrak-active.json");
let lastGood: Snapshot | null = null;
let cachedUntil = 0;
let blockedUntil = 0;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let inFlight: Promise<OrbitCatalogResponse> | null = null;
let persistChain = Promise.resolve();
let bundled: Snapshot | null = null;

function bundledSeed(): Snapshot {
  if (bundled && bundled.records.length > 0) return bundled;
  const { records, dropped } = parseOmmCatalog(demoOmm);
  bundled = { records, fetchedAt: SEED_FETCHED_AT, dropped, origin: "seed" };
  return bundled;
}

/** Live disk snapshot if we have one; otherwise the shipped demo catalog. */
function fallbackSnapshot(): Snapshot {
  if (lastGood && lastGood.records.length > 0) return lastGood;
  return bundledSeed();
}

function toResponse(
  snapshot: Snapshot,
  source: CatalogSource,
  stale: boolean,
  error?: string,
): OrbitCatalogResponse {
  return {
    records: snapshot.records,
    fetchedAt: new Date(snapshot.fetchedAt).toISOString(),
    cachedUntil: cachedUntil ? new Date(cachedUntil).toISOString() : null,
    source,
    stale,
    dropped: snapshot.dropped,
    error,
  };
}

function staleFromFallback(message = CELESTRAK_STALE_MESSAGE): OrbitCatalogResponse {
  const snapshot = fallbackSnapshot();
  const source: CatalogSource = snapshot.origin === "seed" ? "seed" : "stale";
  return toResponse(snapshot, source, true, message);
}

function persist() {
  persistChain = persistChain
    .then(async () => {
      if (!lastGood && blockedUntil <= 0 && cachedUntil <= 0) return;
      await mkdir(path.dirname(diskPath), { recursive: true });
      const live = lastGood?.origin === "live" ? lastGood : null;
      const payload: DiskSnapshot = {
        version: SNAPSHOT_VERSION,
        records: live?.records ?? [],
        fetchedAt: live?.fetchedAt ?? 0,
        dropped: live?.dropped ?? 0,
        cachedUntil,
        blockedUntil,
      };
      await writeFile(diskPath, JSON.stringify(payload), "utf8");
    })
    .catch(() => {
      // Disk full / permissions — keep serving from memory / bundled seed.
    });
}

async function hydrateFromDisk() {
  try {
    const raw = await readFile(diskPath, "utf8");
    const parsed = JSON.parse(raw) as DiskSnapshot;
    if (parsed.version !== SNAPSHOT_VERSION || !Array.isArray(parsed.records)) return;
    cachedUntil = typeof parsed.cachedUntil === "number" ? parsed.cachedUntil : 0;
    blockedUntil = typeof parsed.blockedUntil === "number" ? parsed.blockedUntil : 0;
    if (parsed.records.length === 0) return;
    lastGood = {
      records: parsed.records,
      fetchedAt: parsed.fetchedAt,
      dropped: parsed.dropped ?? 0,
      origin: "live",
    };
  } catch {
    // No snapshot yet — bundled seed covers 403 until a live download succeeds.
  }
}

async function ensureHydrated() {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = hydrateFromDisk().finally(() => {
      hydrated = true;
    });
  }
  await hydratePromise;
}

async function downloadCatalog(): Promise<
  | { ok: true; snapshot: Snapshot }
  | { ok: false; kind: "http"; status: number; retryAfter: string | null }
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
      return {
        ok: false,
        kind: "http",
        status: response.status,
        retryAfter: response.headers.get("retry-after"),
      };
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
      snapshot: { records, fetchedAt: Date.now(), dropped, origin: "live" },
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
    persist();
    return toResponse(result.snapshot, "live", false);
  }
  if (result.kind === "http") {
    // 403/non-200: park retries for ~2h (or Retry-After if longer). HUD Cached.
    blockedUntil = now + policyBlockMs(result.retryAfter, CELESTRAK_BLOCK_MS, now);
    persist();
    return staleFromFallback(CELESTRAK_STALE_MESSAGE);
  }
  cachedUntil = now + CELESTRAK_TRANSIENT_BACKOFF_MS;
  persist();
  return staleFromFallback(result.message);
}

export async function getOrbitCatalog(now = Date.now()): Promise<OrbitCatalogResponse> {
  await ensureHydrated();
  if (lastGood && lastGood.origin === "live" && now < cachedUntil) {
    return toResponse(lastGood, "cache", false);
  }
  if (now < blockedUntil) {
    // Still inside the 403 policy window — do not hit CelesTrak; serve snapshot/seed.
    return staleFromFallback(CELESTRAK_STALE_MESSAGE);
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
  hydrated = false;
  hydratePromise = null;
}

export function seedOrbitCatalogCache(snapshot: Omit<Snapshot, "origin">, ttlMs = CATALOG_TTL_MS) {
  lastGood = { ...snapshot, origin: "live" };
  cachedUntil = snapshot.fetchedAt + ttlMs;
  blockedUntil = 0;
  hydrated = true;
  hydratePromise = Promise.resolve();
}

/** Test seam — override snapshot path (does not persist unless refresh runs). */
export function setOrbitCatalogDiskPath(next: string) {
  diskPath = next;
  hydrated = false;
  hydratePromise = null;
}
