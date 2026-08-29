"use client";

import { SatelliteInspector } from "@/components/sky/satellite-inspector";
import { SatelliteSearch } from "@/components/sky/satellite-search";
import { SatelliteTelemetry } from "@/components/sky/satellite-telemetry";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { EnrichmentHalt } from "@/lib/cala";
import { EUROPEAN_CITIES, type City } from "@/lib/geo/cities";
import { UNKNOWN_OWNER_COLOR } from "@/lib/orbit/constants";
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
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto rounded-xl bg-card/80 shadow-lg ring-1 ring-foreground/10 backdrop-blur-md",
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
}) {
  const status = statusLabel({ loading, source, stale, workerError });
  const headline = headlineCounter(visible, overlay);
  const legend = ownerLegend(visible, overlay);

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
            {(stale || source === "seed") && (
              <span className="max-w-[16rem] truncate text-[10px] text-amber-200/90">
                {catalogError?.trim() || "Using cached catalog; CelesTrak blocked this refresh."}
              </span>
            )}
          </HudChrome>
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

        <HudChrome className="flex flex-col items-end gap-1 px-3 py-2">
          <p className="font-mono text-lg leading-none tabular-nums">
            {headline.topCount}
            <span className="text-muted-foreground"> / {headline.total}</span>
          </p>
          <p className="max-w-[16rem] text-right text-[10px] tracking-wide text-muted-foreground uppercase">
            {headline.parent ? `${headline.parent} / visible` : "verified parent / visible"}
          </p>
        </HudChrome>
      </div>

      <div className="absolute right-3 bottom-3 left-3 flex items-end justify-between gap-3 sm:right-4 sm:bottom-4 sm:left-4">
        <div className="flex min-w-0 max-w-[min(100%,18rem)] flex-col gap-2">
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
              {visible.length.toLocaleString("en-US")} above {city.name}
            </p>
          </HudChrome>
        </div>

        {selected ? (
          <div className="hidden h-[min(62vh,30rem)] sm:block">
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
