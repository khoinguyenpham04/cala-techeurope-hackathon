"use client";

import dynamic from "next/dynamic";

export const SkyStoryCanvas = dynamic(
  () =>
    import("@/components/sky/sky-story-canvas").then((mod) => mod.SkyStoryCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-0 flex-1 items-center justify-center text-muted-foreground text-xs">
        Loading page…
      </div>
    ),
  },
);
