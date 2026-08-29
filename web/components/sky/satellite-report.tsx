"use client";

import { MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { SatelliteIcon } from "@/components/sky/satellite-icon";
import { UNKNOWN_OWNER_COLOR } from "@/lib/orbit/constants";
import type { ReportVisual } from "@/lib/sky/report-visual";
import type {
  QuestionCard,
  QuestionCardImage,
  StoryChip,
  StoryChipTone,
  StoryFact,
  StoryPage,
  StorySource,
} from "@/lib/sky/story-page";
import { cn } from "@/lib/utils";
import { useState, type CSSProperties } from "react";
import "./satellite-report.css";

const CHIP_TONE: Record<StoryChipTone, string> = {
  verified: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  catalog: "bg-sky-500/12 text-sky-300 ring-sky-400/30",
  unverified: "bg-muted/70 text-muted-foreground ring-foreground/10",
  debris: "bg-amber-500/12 text-amber-200 ring-amber-400/30",
  muted: "bg-secondary/80 text-secondary-foreground ring-foreground/8",
};

function Chip({ chip }: { chip: StoryChip }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-[11rem] items-center truncate rounded-full px-2 text-[10px] font-medium ring-1",
        CHIP_TONE[chip.tone],
      )}
    >
      {chip.label}
    </span>
  );
}

function SourceChip({ source }: { source: StorySource }) {
  const label = source.date ? `${source.name} · ${source.date}` : source.name;
  const className = cn(
    "inline-flex h-5 max-w-[12rem] items-center truncate rounded-full bg-secondary/70 px-2 text-[10px] font-medium text-secondary-foreground ring-1 ring-foreground/8 transition-transform duration-150 ease-out",
    source.url && "hover:bg-secondary active:scale-[0.96]",
  );
  if (!source.url) {
    return <span className={className}>{label}</span>;
  }
  return (
    <a
      className={className}
      href={source.url}
      rel="noreferrer"
      target="_blank"
    >
      {label}
    </a>
  );
}

function HeroMedia({
  visual,
  accent,
}: {
  visual: ReportVisual;
  accent: string;
}) {
  const [failed, setFailed] = useState(false);
  const photo = visual.kind === "photo" && visual.src && !failed;

  return (
    <div className="satellite-hero" style={{ "--hero-accent": accent } as CSSProperties}>
      {photo ? (
        <>
          <img
            alt={visual.alt}
            className="satellite-hero-photo"
            onError={() => setFailed(true)}
            src={visual.src}
          />
          <div className="satellite-hero-photo-veil" />
          {visual.credit ? (
            <p className="satellite-hero-credit">
              {visual.sourceUrl ? (
                <a href={visual.sourceUrl} rel="noreferrer" target="_blank">
                  {visual.credit}
                </a>
              ) : (
                visual.credit
              )}
            </p>
          ) : null}
        </>
      ) : (
        <div aria-hidden className="satellite-hero-glyph">
          <span className="satellite-hero-earth" />
          <span className="satellite-hero-orbit satellite-hero-orbit-a" />
          <span className="satellite-hero-orbit satellite-hero-orbit-b" />
          <SatelliteIcon className="satellite-hero-icon size-10" strokeWidth={1.5} />
          <p className="satellite-hero-caption">{visual.familyLabel}</p>
        </div>
      )}
    </div>
  );
}

function FactRow({
  fact,
  identityUrls,
}: {
  fact: StoryFact;
  identityUrls: Set<string>;
}) {
  const sources =
    fact.known && fact.sources
      ? fact.tone === "verified"
        ? fact.sources
        : fact.sources.filter((source) => source.url && !identityUrls.has(source.url))
      : [];

  return (
    <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
      <dt className="pt-0.5 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {fact.label}
      </dt>
      <dd className="min-w-0">
        {fact.known ? (
          <p className="text-pretty text-sm leading-relaxed text-foreground/90">{fact.value}</p>
        ) : (
          <span className="inline-flex h-5 items-center rounded-full bg-muted/70 px-2 text-[10px] font-medium text-muted-foreground ring-1 ring-foreground/8">
            Not verified yet
          </span>
        )}
        {sources.length > 0 ? (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {sources.map((source) => (
              <li key={source.url || source.name}>
                <SourceChip source={source} />
              </li>
            ))}
          </ul>
        ) : null}
      </dd>
    </div>
  );
}

function imageVisual(image: QuestionCardImage): ReportVisual {
  return {
    kind: "photo",
    family: "QUESTION",
    familyLabel: image.credit ?? "Photo",
    src: image.src,
    alt: image.alt,
    credit: image.credit,
    sourceUrl: image.sourceUrl,
    debris: false,
  };
}

function QuestionCardView({
  card,
  accent,
}: {
  card: QuestionCard;
  accent: string;
}) {
  const hero = card.images[0];
  const extras = card.images.slice(1, 4);
  const showSources = card.sources.length > 0;
  const showUnavailable = card.sourcesUnavailable && !showSources;

  return (
    <article className="satellite-report-card overflow-hidden rounded-2xl bg-card/90 shadow-[0_1px_0_oklch(1_0_0/0.06),0_16px_40px_oklch(0_0_0/0.32)] ring-1 ring-foreground/12">
      {hero ? <HeroMedia accent={accent} visual={imageVisual(hero)} /> : null}
      <div className="flex flex-col gap-4 px-5 py-5">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Question
          </p>
          <h3 className="font-heading text-pretty text-base font-medium tracking-tight">
            {card.question || "Question"}
          </h3>
        </div>
        {card.streaming && !card.answer ? (
          <Shimmer className="text-xs" duration={1.4}>
            Writing…
          </Shimmer>
        ) : (
          <p className="text-pretty text-sm leading-relaxed text-foreground/90">
            {card.answer}
          </p>
        )}
        {extras.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2">
            {extras.map((image) => (
              <li key={image.src}>
                <a
                  className="block overflow-hidden rounded-lg ring-1 ring-foreground/10"
                  href={image.sourceUrl ?? image.src}
                  rel="noreferrer"
                  target="_blank"
                >
                  <img
                    alt={image.alt}
                    className="aspect-[4/3] w-full object-cover"
                    src={image.src}
                  />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {showUnavailable ? (
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Sources unavailable
          </p>
        ) : null}
        {showSources ? (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Sources
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {card.kind === "web" ? (
                <li>
                  <span className="inline-flex h-5 items-center rounded-full bg-secondary/70 px-2 text-[10px] font-medium text-secondary-foreground ring-1 ring-foreground/8">
                    Web
                  </span>
                </li>
              ) : null}
              {card.sources.map((source) => (
                <li key={source.url || source.name}>
                  <SourceChip source={source} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ExtraNote({ block }: { block: StoryPage["extraBlocks"][number] }) {
  if (block.type === "paragraph" || block.type === "quote") {
    return <p className="text-pretty text-sm leading-relaxed text-foreground/90">{block.text}</p>;
  }
  if (block.type === "list") {
    const List = block.ordered ? "ol" : "ul";
    return (
      <List className={cn("space-y-1 text-sm text-foreground/90", block.ordered ? "list-decimal pl-5" : "list-disc pl-5")}>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </List>
    );
  }
  if (block.type === "callout") {
    return (
      <p className="text-pretty text-sm leading-relaxed text-foreground/90">
        <span className="font-medium">{block.title}. </span>
        {block.body}
      </p>
    );
  }
  return null;
}

export function SatelliteReport({
  page,
  accent,
}: {
  page: StoryPage;
  accent?: string | null;
}) {
  const identity = page.identity;
  const heroAccent = accent?.trim() || UNKNOWN_OWNER_COLOR;
  const showLesson =
    Boolean(page.lessonMarkdown) &&
    page.lessonMarkdown !== "No verified Cala data found";
  const identityUrls = new Set(
    identity?.sources.map((source) => source.url).filter(Boolean) ?? [],
  );

  if (!identity) {
    return (
      <section className="satellite-report mx-auto w-full max-w-xl px-5 py-8 sm:px-6">
        <article className="satellite-report-card overflow-hidden rounded-2xl bg-card/90 shadow-[0_1px_0_oklch(1_0_0/0.06),0_16px_40px_oklch(0_0_0/0.32)] ring-1 ring-foreground/12">
          <div
            className="satellite-hero"
            style={{ "--hero-accent": UNKNOWN_OWNER_COLOR } as CSSProperties}
          >
            <div aria-hidden className="satellite-hero-glyph">
              <span className="satellite-hero-earth" />
              <span className="satellite-hero-orbit satellite-hero-orbit-a" />
              <span className="satellite-hero-orbit satellite-hero-orbit-b" />
              <SatelliteIcon className="satellite-hero-icon size-10" strokeWidth={1.5} />
              <p className="satellite-hero-caption">Sky console</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 px-5 py-5">
            <h2 className="font-heading text-xl font-semibold tracking-tight">Pick a satellite</h2>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              Click an object on the globe, search by name, or use Demo pick. This page fills from the catalog brief right away.
            </p>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="satellite-report mx-auto flex w-full max-w-xl flex-col gap-4 px-5 py-6 sm:px-6">
      <article className="satellite-report-card overflow-hidden rounded-2xl bg-card/90 shadow-[0_1px_0_oklch(1_0_0/0.06),0_16px_40px_oklch(0_0_0/0.32)] ring-1 ring-foreground/12">
        <HeroMedia accent={heroAccent} visual={identity.visual} />
        <div className="flex flex-col gap-3 px-5 py-5">
          <header className="flex flex-col gap-1">
            <h2 className="font-heading text-balance text-2xl font-semibold tracking-tight text-foreground">
              {identity.name}
            </h2>
            <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
              NORAD {identity.noradId}
            </p>
          </header>
          {identity.chips.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {identity.chips.map((chip) => (
                <li key={chip.id}>
                  <Chip chip={chip} />
                </li>
              ))}
            </ul>
          ) : null}
          {identity.blurb ? (
            <p className="text-pretty text-sm leading-relaxed text-foreground/90">{identity.blurb}</p>
          ) : null}
          {identity.sources.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 pt-1">
              {identity.sources.map((source) => (
                <li key={source.url || source.name}>
                  <SourceChip source={source} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </article>

      <article className="satellite-report-card overflow-hidden rounded-2xl bg-card/90 shadow-[0_1px_0_oklch(1_0_0/0.06),0_16px_40px_oklch(0_0_0/0.32)] ring-1 ring-foreground/12">
        <div className="flex flex-col gap-6 px-5 py-5">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Report
            </p>
            <h3 className="font-heading text-base font-medium tracking-tight">Who owns this, and why</h3>
          </div>
          <dl className="flex flex-col gap-4">
            {page.facts.map((fact) => (
              <FactRow fact={fact} identityUrls={identityUrls} key={fact.id} />
            ))}
          </dl>
          {page.extraBlocks.length > 0 ? (
            <div className="flex flex-col gap-3">
              {page.extraBlocks.map((block) => (
                <ExtraNote block={block} key={block.id} />
              ))}
            </div>
          ) : null}
          {showLesson ? (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Notes
              </p>
              <MessageResponse className="text-sm leading-relaxed text-foreground/90">
                {page.lessonMarkdown ?? ""}
              </MessageResponse>
            </div>
          ) : (
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              Catalog rows stay here. Ask below to open a new sourced card.
            </p>
          )}
        </div>
      </article>

      {page.questionCards.map((card) => (
        <QuestionCardView accent={heroAccent} card={card} key={card.id} />
      ))}
    </section>
  );
}
