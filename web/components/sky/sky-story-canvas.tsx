"use client";

import { SatelliteReport } from "@/components/sky/satellite-report";
import type { SatelliteDossier } from "@/lib/cala";
import { overlayFor } from "@/lib/orbit/overlay";
import type { SatelliteOverlayMap } from "@/lib/orbit/types";
import {
  buildStoryPage,
  collectStoryPageExtras,
  storyCardFromQuestion,
  type QuestionCard,
  type StoryCard,
  type StoryObjectIdentity,
} from "@/lib/sky/story-page";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef } from "react";

const STICK_PX = 80;

export function SkyStoryCanvas({
  className,
  satellite,
  overlay,
  noradId,
  dossier,
  lessonText,
  questionCards,
  storyCards,
  extraTexts,
  onAsk,
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
  storyCards?: StoryCard[] | null;
  extraTexts?: (string | null | undefined)[] | null;
  onAsk?: (question: string) => void;
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
  const cards = useMemo(
    () => storyCards ?? questionCards?.map(storyCardFromQuestion) ?? [],
    [questionCards, storyCards],
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
        storyCards: cards,
      }),
    [identity, overlayRow, dossier, extraBlocks, cards],
  );

  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const cardCount = cards.length;
  const lastPhase = cards[cards.length - 1]?.phase ?? "";

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const scroller = root;
    function onScroll() {
      const gap = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      pinnedRef.current = gap <= STICK_PX;
    }
    scroller.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!pinnedRef.current) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sentinelRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [cardCount, lastPhase]);

  return (
    <div
      className={cn("relative min-h-0 min-w-0 flex-1 overflow-y-auto", className)}
      ref={scrollerRef}
    >
      <SatelliteReport
        accent={overlayRow?.ownerColor}
        key={selectedNorad ?? "empty"}
        onAsk={onAsk}
        page={page}
      />
      <div aria-hidden className="h-px w-full" ref={sentinelRef} />
    </div>
  );
}
