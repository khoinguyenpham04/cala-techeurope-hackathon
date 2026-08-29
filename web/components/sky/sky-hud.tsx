"use client";

import { SatelliteIcon } from "@/components/sky/satellite-icon";
import { SatelliteInspector } from "@/components/sky/satellite-inspector";
import { SatelliteSearch } from "@/components/sky/satellite-search";
import { SatelliteTelemetry } from "@/components/sky/satellite-telemetry";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import type { EnrichmentHalt } from "@/lib/cala";
import type { City } from "@/lib/geo/cities";
import { UNKNOWN_OWNER_COLOR } from "@/lib/orbit/constants";
import { evidenceCoverage, ownerLegend } from "@/lib/orbit/overlay";
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
  if (args.source === "local") {
    return { label: "Local", tone: "bg-emerald-500" };
  }
  if (args.source === "seed" || args.stale) {
    return { label: "Cached", tone: "bg-amber-500" };
  }
  if (args.source === "live" || args.source === "cache") {
    return { label: "Live", tone: "bg-emerald-500" };
  }
  return { label: "Offline", tone: "bg-red-500" };
}

function enrichmentHaltLabel(
  halt: EnrichmentHalt,
  hasCachedEvidence: boolean,
): string {
  const fallback = hasCachedEvidence
    ? "Showing cached Cala evidence; catalog briefs still fill the page."
    : "Catalog briefs still fill the page; Cala-cited ownership is paused.";
  if (halt.code === "rate_limited") return `Live Cala is resting. ${fallback}`;
  if (halt.code === "timeout") return `Live Cala timed out. ${fallback}`;
  if (halt.code === "unconfigured") return `Live Cala is not configured. ${fallback}`;
  return `Live Cala is unavailable. ${fallback}`;
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
  visible,
  overlay,
  selected,
  selectedOmm,
  onSelect,
  onDemoPick,
  loading,
  source,
  stale,
  workerError,
  enrichmentHalt,
  showSidebarTrigger,
  horizonOnly,
  onHorizonOnlyChange,
}: {
  city: City;
  visible: VisibleSatellite[];
  overlay: SatelliteOverlayMap;
  selected: VisibleSatellite | null;
  selectedOmm: SlimOmm | null;
  onSelect: (noradId: string | null) => void;
  onDemoPick: () => void;
  loading: boolean;
  source: CatalogSource | undefined;
  stale: boolean;
  workerError: string | null;
  enrichmentHalt?: EnrichmentHalt | null;
  showSidebarTrigger: boolean;
  horizonOnly: boolean;
  onHorizonOnlyChange: (horizonOnly: boolean) => void;
}) {
  const status = statusLabel({ loading, source, stale, workerError });
  const coverage = evidenceCoverage(visible, overlay);
  const legend = ownerLegend(visible, overlay);
  const hasCachedEvidence = Object.values(overlay).some(
    (entry) =>
      entry.evidenceState !== "unknown" &&
      entry.sources?.some((sourceEntry) => sourceEntry.url.trim()),
  );

  return (
    <div className="dark pointer-events-none absolute inset-0 z-10 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 max-w-full flex-col gap-2">
          <div className="pointer-events-auto">
            <SatelliteSearch
              onDemoPick={onDemoPick}
              onSelect={onSelect}
              selected={selected}
              visible={visible}
            />
          </div>
          <HudChrome className="flex max-w-full flex-wrap items-center gap-2 px-2 py-1.5">
            {showSidebarTrigger ? <SidebarTrigger className="-ml-0.5" /> : null}
            <span className="px-1 text-[11px] text-foreground">{city.name}</span>
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
              {enrichmentHaltLabel(enrichmentHalt, hasCachedEvidence)}
            </div>
          ) : null}
        </div>

        <HudChrome className="flex flex-col items-end gap-1 px-3 py-2" interactive={false}>
          <p className="font-mono text-lg leading-none tabular-nums">
            {coverage.verifiedCount}
            <span className="text-muted-foreground"> / {coverage.total}</span>
          </p>
          <p className="max-w-[16rem] text-right text-[10px] tracking-wide text-muted-foreground uppercase">
            Cala verified / tracked
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
              Organizations
            </p>
            {legend.map((entry) => (
              <div className="flex items-center gap-2" key={entry.label}>
                <SatelliteIcon
                  className="size-3 shrink-0"
                  style={{ color: entry.color }}
                />
                <span className="min-w-0 truncate" title={entry.label}>
                  {entry.label}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <SatelliteIcon
                className="size-3 shrink-0"
                style={{ color: UNKNOWN_OWNER_COLOR }}
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
