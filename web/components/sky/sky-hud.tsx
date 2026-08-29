"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import type { EnrichmentHalt } from "@/lib/cala";
import { EUROPEAN_CITIES, type City } from "@/lib/geo/cities";
import { UNKNOWN_OWNER_COLOR } from "@/lib/orbit/constants";
import { headlineCounter, ownerLegend } from "@/lib/orbit/overlay";
import type { CatalogSource, SatelliteOverlayMap, VisibleSatellite } from "@/lib/orbit/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SatelliteInspector } from "@/components/sky/satellite-inspector";

function statusLabel(args: {
  loading: boolean;
  source: CatalogSource | undefined;
  stale: boolean;
  workerError: string | null;
}) {
  if (args.loading) return { label: "Loading", tone: "bg-amber-500" };
  if (args.workerError) return { label: "Worker error", tone: "bg-red-500" };
  if (args.stale) return { label: "Stale cache", tone: "bg-amber-500" };
  if (args.source === "live" || args.source === "cache") {
    return { label: "Live", tone: "bg-emerald-500" };
  }
  return { label: "Offline", tone: "bg-red-500" };
}

function enrichmentHaltLabel(halt: EnrichmentHalt): string {
  if (halt.message.trim()) return halt.message;
  if (halt.code === "rate_limited") return "Cala rate limited (429). Ownership enrichment paused.";
  if (halt.code === "timeout") return "Cala timed out. Ownership enrichment paused.";
  if (halt.code === "unconfigured") return "Cala is not configured. Ownership enrichment paused.";
  if (halt.code === "unreachable") return "Cala is unreachable. Ownership enrichment paused.";
  return "Ownership enrichment paused.";
}

function UtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <time
      className="font-mono text-[11px] text-muted-foreground tabular-nums"
      dateTime={now.toISOString()}
      suppressHydrationWarning
    >
      {now.toISOString().replace(".000", "").replace("T", " ").replace("Z", " UTC")}
    </time>
  );
}

export function SkyHud({
  city,
  onCityChange,
  visible,
  overlay,
  selected,
  onSelect,
  loading,
  source,
  stale,
  catalogError,
  workerError,
  enrichmentHalt,
  showSidebarTrigger,
}: {
  city: City;
  onCityChange: (cityId: string) => void;
  visible: VisibleSatellite[];
  overlay: SatelliteOverlayMap;
  selected: VisibleSatellite | null;
  onSelect: (noradId: string | null) => void;
  loading: boolean;
  source: CatalogSource | undefined;
  stale: boolean;
  catalogError?: string;
  workerError: string | null;
  enrichmentHalt?: EnrichmentHalt | null;
  showSidebarTrigger: boolean;
}) {
  const status = statusLabel({ loading, source, stale, workerError });
  const headline = headlineCounter(visible, overlay);
  const legend = ownerLegend(visible, overlay);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-xl bg-card/85 px-2 py-1.5 shadow-lg ring-1 ring-foreground/10 backdrop-blur-md">
          {showSidebarTrigger ? <SidebarTrigger className="-ml-0.5" /> : null}
          <NativeSelect
            aria-label="Observer city"
            onChange={(event) => onCityChange(event.target.value)}
            size="sm"
            value={city.id}
          >
            {EUROPEAN_CITIES.map((entry) => (
              <NativeSelectOption key={entry.id} value={entry.id}>
                {entry.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <UtcClock />
          <span className="flex items-center gap-1.5 pr-1 text-[11px] text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", status.tone)} />
            {status.label}
          </span>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-1 rounded-xl bg-card/85 px-3 py-2 shadow-lg ring-1 ring-foreground/10 backdrop-blur-md">
          <p className="font-mono text-lg leading-none tabular-nums">
            {headline.topCount}
            <span className="text-muted-foreground"> / {headline.total}</span>
          </p>
          <p className="max-w-[16rem] text-right text-[10px] tracking-wide text-muted-foreground uppercase">
            {headline.parent ? `${headline.parent} / visible` : "verified parent / visible"}
          </p>
        </div>
      </div>

      {(catalogError || workerError || enrichmentHalt) && (
        <div className="pointer-events-auto mx-auto flex max-w-md flex-col gap-2">
          {(workerError || catalogError) && (
            <div
              className="rounded-lg bg-destructive/15 px-3 py-2 text-center text-destructive text-xs"
              role="status"
            >
              {workerError || catalogError}
            </div>
          )}
          {enrichmentHalt ? (
            <div
              className="rounded-lg bg-amber-500/15 px-3 py-2 text-center text-xs text-amber-950 ring-1 ring-amber-500/25 dark:text-amber-100"
              role="status"
            >
              {enrichmentHaltLabel(enrichmentHalt)}
            </div>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="pointer-events-auto flex flex-col gap-1.5 rounded-xl bg-card/85 px-3 py-2 text-[11px] shadow-lg ring-1 ring-foreground/10 backdrop-blur-md">
          <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Operators
          </p>
          {legend.map((entry) => (
            <div className="flex items-center gap-2" key={entry.label}>
              <span
                className="size-2 shrink-0 rounded-full ring-1 ring-foreground/20"
                style={{ backgroundColor: entry.color }}
              />
              <span className="min-w-0 truncate" title={entry.label}>
                {entry.label}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full ring-1 ring-foreground/20"
              style={{ backgroundColor: UNKNOWN_OWNER_COLOR }}
            />
            <span className="text-muted-foreground">Unknown owner</span>
          </div>
          <p className="text-muted-foreground">
            {visible.length.toLocaleString("en-US")} above {city.name}
          </p>
        </div>
        {selected ? (
          <SatelliteInspector
            onClose={() => onSelect(null)}
            overlay={overlay}
            satellite={selected}
          />
        ) : null}
      </div>
    </div>
  );
}
