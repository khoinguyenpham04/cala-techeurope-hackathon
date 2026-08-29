"use client";

import { StoryPageEditor } from "@/components/sky/story-page-editor";
import type { SatelliteDossier } from "@/lib/cala";
import { overlayFor } from "@/lib/orbit/overlay";
import type { SatelliteOverlayMap } from "@/lib/orbit/types";
import {
  buildStoryPage,
  parseStoryPageJson,
  type StoryObjectIdentity,
} from "@/lib/sky/story-page";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export function SkyStoryCanvas({
  className,
  satellite,
  overlay,
  noradId,
  dossier,
  lessonText,
  lessonStreaming,
}: {
  className?: string;
  satellite: StoryObjectIdentity | null;
  overlay?: SatelliteOverlayMap;
  noradId?: string | null;
  dossier?: SatelliteDossier | null;
  userPrompt?: string | null;
  lessonText?: string | null;
  lessonStreaming?: boolean;
}) {
  const selectedNorad = satellite?.noradId ?? noradId ?? null;
  const selectedName =
    satellite?.name ?? (selectedNorad ? `NORAD ${selectedNorad}` : null);
  const identity = useMemo((): StoryObjectIdentity | null => {
    if (!selectedNorad || !selectedName) return null;
    return { noradId: selectedNorad, name: selectedName };
  }, [selectedName, selectedNorad]);
  const overlayRow = selectedNorad ? overlayFor(overlay, selectedNorad) : undefined;
  const extraBlocks = useMemo(
    () => (lessonText ? parseStoryPageJson(lessonText) : null),
    [lessonText],
  );

  const page = useMemo(
    () =>
      buildStoryPage({
        satellite: identity,
        overlay: overlayRow,
        dossier,
        lessonText,
        lessonStreaming,
        extra: extraBlocks,
      }),
    [identity, overlayRow, dossier, lessonText, lessonStreaming, extraBlocks],
  );

  return (
    <div className={cn("relative min-h-0 min-w-0 flex-1 overflow-y-auto", className)}>
      <div className="mx-auto w-full max-w-xl px-5 py-8 sm:px-6">
        <StoryPageEditor key={selectedNorad ?? "empty"} page={page} />
      </div>
    </div>
  );
}
