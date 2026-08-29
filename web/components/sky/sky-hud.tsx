"use client";

import { SatelliteInspector } from "@/components/sky/satellite-inspector";
import { SatelliteSearch } from "@/components/sky/satellite-search";
import { SatelliteTelemetry } from "@/components/sky/satellite-telemetry";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import type { EnrichmentHalt } from "@/lib/cala";
import { EUROPEAN_CITIES, type City } from "@/lib/geo/cities";
import { CELESTRAK_STALE_MESSAGE, UNKNOWN_OWNER_COLOR } from "@/lib/orbit/constants";
import { headlineCounter, ownerLegend } from "@/lib/orbit/overlay";
import type {
  CatalogSource,
  SatelliteOverlayMap,
  SlimOmm,
  VisibleSatellite,
} from "@/lib/orbit/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

function statusLabel(args: {
  loading: boolean;
  source: CatalogSource | undefined;
  stale: boolean;
  workerError: string | null;
}) {
  if (args.loading) return { label: "Loading", tone: "bg-amber-500" };
  if (args.workerError) return { label: "Worker error", tone: "bg-red-500" };
  if (args.source === "seed" || args.stale) {
    return { label: "Cached", tone: "bg-amber-500" };
  }
  if (args.source === "live" || args.source === "cache") {
    return { label: "Live", tone: "bg-emerald-500" };
  }
  return { label: "Offline", tone: "bg-red-500" };
}

/**
 * Plain-language Cached reason. CelesTrak 403 → ~2h no-retry → disk snapshot
 * or bundled seed. Never put this in the globe center.
 */
function cacheExplanation(
  source: CatalogSource | undefined,
  stale: boolean,
  catalogError?: string,
): string | null {
  if (source === "seed") {
    return "CelesTrak returned 403. Showing the bundled demo catalog, not the live sky. We wait about 2 hours before asking again.";
  }
  if (source === "stale" || stale) {
    const detail = catalogError?.trim();
    return detail && detail.length > 0 ? detail : CELESTRAK_STALE_MESSAGE;
  }
  return null;
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

function HudChrome({
  className,
  children,
  interactive = true,
}: {
  className?: string;
  children: React.ReactNode;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-card/80 shadow-lg ring-1 ring-foreground/10 backdrop-blur-md",
        interactive ? "pointer-events-auto" : "pointer-events-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SkyHud({
  city,
  onCityChange,
  visible,
  overlay,
  selected,
  selectedOmm,
  onSelect,
  loading,
  source,
  stale,
  catalogError,
  workerError,
  enrichmentHalt,
  showSidebarTrigger,
  horizonOnly,
  onHorizonOnlyChange,
}: {
  city: City;
  onCityChange: (cityId: string) => void;
  visible: VisibleSatellite[];
  overlay: SatelliteOverlayMap;
  selected: VisibleSatellite | null;
  selectedOmm: SlimOmm | null;
  onSelect: (noradId: string | null) => void;
  loading: boolean;
  source: CatalogSource | undefined;
  stale: boolean;
  catalogError?: string;
  workerError: string | null;
  enrichmentHalt?: EnrichmentHalt | null;
  showSidebarTrigger: boolean;
  horizonOnly: boolean;
  onHorizonOnlyChange: (horizonOnly: boolean) => void;
}) {
  const status = statusLabel({ loading, source, stale, workerError });
  const headline = headlineCounter(visible, overlay);
  const legend = ownerLegend(visible, overlay);
  const cachedWhy = cacheExplanation(source, stale, catalogError);

  return (
    <div className="dark pointer-events-none absolute inset-0 z-10 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 max-w-full flex-col gap-2">
          <div className="pointer-events-auto">
            <SatelliteSearch onSelect={onSelect} selected={selected} visible={visible} />
          </div>
          <HudChrome className="flex max-w-full flex-wrap items-center gap-2 px-2 py-1.5">
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
            <label className="flex cursor-pointer items-center gap-2 pr-1 text-[11px] text-muted-foreground">
              <span className={horizonOnly ? "text-muted-foreground" : "text-foreground"}>
                All orbits
              </span>
              <Switch
                aria-label={horizonOnly ? "Above city" : "All orbits"}
                checked={horizonOnly}
                onCheckedChange={onHorizonOnlyChange}
                size="sm"
              />
              <span className={horizonOnly ? "text-foreground" : "text-muted-foreground"}>
                Above city
              </span>
            </label>
          </HudChrome>
          {cachedWhy ? (
            <HudChrome
              className="max-w-[22rem] px-3 py-2 text-[11px] leading-snug text-amber-100/90"
              interactive={false}
            >
              <p>{cachedWhy}</p>
            </HudChrome>
          ) : null}
          {workerError ? (
            <div
              className="pointer-events-auto rounded-lg bg-destructive/20 px-3 py-2 text-destructive text-xs ring-1 ring-destructive/30"
              role="status"
            >
              {workerError}
            </div>
          ) : null}
          {enrichmentHalt ? (
            <div
              className="pointer-events-auto rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-100 ring-1 ring-amber-500/25"
              role="status"
            >
              {enrichmentHaltLabel(enrichmentHalt)}
            </div>
          ) : null}
        </div>

        <HudChrome className="flex flex-col items-end gap-1 px-3 py-2" interactive={false}>
          <p className="font-mono text-lg leading-none tabular-nums">
            {headline.topCount}
            <span className="text-muted-foreground"> / {headline.total}</span>
          </p>
          <p className="max-w-[16rem] text-right text-[10px] tracking-wide text-muted-foreground uppercase">
            {headline.parent ? `${headline.parent} / visible` : "verified parent / visible"}
          </p>
        </HudChrome>
      </div>

      <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 sm:inset-x-4 sm:bottom-4">
        <div className="flex min-w-0 max-w-[min(100%,18rem)] flex-col gap-2">
          {selected ? (
            <div className="h-[min(36vh,16rem)] sm:hidden">
              <SatelliteInspector
                omm={selectedOmm}
                onClose={() => onSelect(null)}
                overlay={overlay}
                satellite={selected}
              />
            </div>
          ) : null}
          {selected ? <SatelliteTelemetry satellite={selected} /> : null}
          <HudChrome className="flex flex-col gap-1.5 px-3 py-2 text-[11px]">
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
              {horizonOnly
                ? `${visible.length.toLocaleString("en-US")} above ${city.name}`
                : `${visible.length.toLocaleString("en-US")} on globe`}
            </p>
          </HudChrome>
        </div>

        {selected ? (
          <div className="pointer-events-none hidden h-[min(62vh,30rem)] w-[18.5rem] shrink-0 sm:block">
            <SatelliteInspector
              omm={selectedOmm}
              onClose={() => onSelect(null)}
              overlay={overlay}
              satellite={selected}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
