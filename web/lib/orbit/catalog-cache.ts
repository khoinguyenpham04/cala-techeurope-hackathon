import barcelonaOmm from "@/lib/orbit/seed/barcelona-omm.json";
import { parseOmmCatalog } from "@/lib/orbit/omm";
import type { OrbitCatalogResponse } from "@/lib/orbit/types";

/**
 * Shipped local snapshot: CelesTrak stations + visual objects that can overfly
 * Barcelona (~120 OMMs, 2026-08-29). Loaded from JSON — no runtime CelesTrak
 * fetch. SGP4 still runs at 1 Hz so positions stay current relative to these
 * elements. Wikipedia-style briefs live in `wiki-dossiers.ts`.
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
