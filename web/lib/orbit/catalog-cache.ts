import barcelonaOmm from "@/lib/orbit/seed/barcelona-omm.json";
import { parseOmmCatalog } from "@/lib/orbit/omm";
import type { OrbitCatalogResponse } from "@/lib/orbit/types";

/**
 * Shipped CelesTrak `GROUP=stations` snapshot (ISS, CSS, visiting vehicles).
 * Downloaded once (2026-08-29) and loaded from this JSON — no runtime
 * CelesTrak fetch, no disk cache, no 403 backoff. SGP4 still runs at 1 Hz
 * so the Barcelona sky is current relative to these elements.
 */
export function getOrbitCatalog(): OrbitCatalogResponse {
  const { records, dropped } = parseOmmCatalog(barcelonaOmm);
  return {
    records,
    fetchedAt: records[0]?.EPOCH ?? null,
    cachedUntil: null,
    source: "local",
    stale: false,
    dropped,
  };
}
