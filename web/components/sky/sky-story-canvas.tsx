"use client";

import { SatelliteReport } from "@/components/sky/satellite-report";
import type { SatelliteDossier } from "@/lib/cala";
import { overlayFor } from "@/lib/orbit/overlay";
import type { SatelliteOverlayMap } from "@/lib/orbit/types";
import {
  buildStoryPage,
  collectStoryPageExtras,
  type QuestionCard,
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
  questionCards,
  extraTexts,
}: {
  className?: string;
  satellite: StoryObjectIdentity | null;
  overlay?: SatelliteOverlayMap;
  noradId?: string | null;
  dossier?: SatelliteDossier | null;
  userPrompt?: string | null;
  lessonText?: string | null;
  lessonStreaming?: boolean;
  questionCards?: QuestionCard[] | null;
  extraTexts?: (string | null | undefined)[] | null;
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
    () => collectStoryPageExtras(extraTexts?.length ? extraTexts : [lessonText]),
    [extraTexts, lessonText],
  );

  const page = useMemo(
    () =>
      buildStoryPage({
        satellite: identity,
        overlay: overlayRow,
        dossier,
        lessonText: null,
        lessonStreaming: false,
        extra: extraBlocks,
        questionCards,
      }),
    [identity, overlayRow, dossier, extraBlocks, questionCards],
  );

  return (
    <div className={cn("relative min-h-0 min-w-0 flex-1 overflow-y-auto", className)}>
      <SatelliteReport
        accent={overlayRow?.ownerColor}
        key={selectedNorad ?? "empty"}
        page={page}
      />
    </div>
  );
}
