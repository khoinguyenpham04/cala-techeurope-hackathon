"use client";

import dynamic from "next/dynamic";

export const GlobeCanvas = dynamic(
  () => import("@/components/sky/globe-scene").then((mod) => mod.GlobeScene),
  {
    ssr: false,
    loading: () => (
      // Catalog cache status lives in the HUD, not this globe-center placeholder.
      <div className="absolute inset-0 flex items-center justify-center bg-black text-muted-foreground text-xs">
        Initializing globe…
      </div>
    ),
  },
);
