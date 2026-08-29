"use client";

import dynamic from "next/dynamic";

export const GlobeCanvas = dynamic(
  () => import("@/components/sky/globe-scene").then((mod) => mod.GlobeScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-black text-muted-foreground text-xs">
        Initializing globe…
      </div>
    ),
  },
);
