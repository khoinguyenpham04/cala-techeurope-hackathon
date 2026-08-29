"use client";

import { getOrbitCatalog } from "@/lib/orbit/catalog-cache";
import type { OrbitCatalogResponse } from "@/lib/orbit/types";
import { useMemo } from "react";

/** Local JSON only — the browser never talks to CelesTrak. */
export function useOrbitCatalog(): { catalog: OrbitCatalogResponse; loading: false } {
  const catalog = useMemo(() => getOrbitCatalog(), []);
  return { catalog, loading: false };
}
