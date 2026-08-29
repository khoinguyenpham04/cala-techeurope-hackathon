"use client";

import type { OrbitCatalogResponse } from "@/lib/orbit/types";
import { useEffect, useState } from "react";

export function useOrbitCatalog() {
  const [catalog, setCatalog] = useState<OrbitCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/orbits")
      .then(async (response) => {
        const body = (await response.json()) as OrbitCatalogResponse;
        if (!cancelled) setCatalog(body);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setCatalog({
          records: [],
          fetchedAt: null,
          cachedUntil: null,
          source: "stale",
          stale: true,
          dropped: 0,
          error: cause instanceof Error ? cause.message : "Could not load the orbit catalog.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, loading };
}
