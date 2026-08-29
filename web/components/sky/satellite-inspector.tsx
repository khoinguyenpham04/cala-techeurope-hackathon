"use client";

import { Button } from "@/components/ui/button";
import { UNKNOWN_OWNER_COLOR } from "@/lib/orbit/constants";
import { overlayFor } from "@/lib/orbit/overlay";
import type { SatelliteOverlayMap, VisibleSatellite } from "@/lib/orbit/types";
import { XIcon } from "@phosphor-icons/react";

function formatKm(value: number, digits = 1) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })} km`;
}

function formatDeg(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}°`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="font-mono text-[13px] text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

export function SatelliteInspector({
  satellite,
  overlay,
  onClose,
}: {
  satellite: VisibleSatellite;
  overlay?: SatelliteOverlayMap;
  onClose: () => void;
}) {
  const dossier = overlayFor(overlay, satellite.noradId);
  const operator = dossier?.operator?.trim() || "Unknown";
  const purpose = dossier?.purpose?.trim() || "Unknown";
  const parent = dossier?.ultimateParent?.trim() || "Unknown";
  const evidence = dossier?.evidenceState ?? "unknown";
  const catalogUrl = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${encodeURIComponent(satellite.noradId)}&FORMAT=JSON`;

  return (
    <aside className="pointer-events-auto w-[min(100%,20rem)] rounded-xl bg-card/90 p-3 shadow-lg ring-1 ring-foreground/10 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-sm leading-tight">{satellite.name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
            NORAD {satellite.noradId}
            {satellite.objectId ? ` · ${satellite.objectId}` : ""}
          </p>
        </div>
        <Button
          aria-label="Clear selection"
          className="size-7 shrink-0"
          onClick={onClose}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
        <Field label="Altitude" value={formatKm(satellite.altitudeKm)} />
        <Field label="Elevation" value={formatDeg(satellite.elevationDeg)} />
        <Field label="Azimuth" value={formatDeg(satellite.azimuthDeg)} />
        <Field label="Range" value={formatKm(satellite.rangeKm, 0)} />
        <Field label="Operator" value={operator} />
        <Field label="Parent" value={parent} />
        <Field label="Purpose" value={purpose} />
        <Field label="Evidence" value={evidence} />
      </dl>

      <div className="mt-3 flex flex-col gap-1.5 border-t border-border/60 pt-2.5">
        <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Sources
        </p>
        <a
          className="text-xs text-primary underline-offset-4 hover:underline"
          href={catalogUrl}
          rel="noreferrer"
          target="_blank"
        >
          CelesTrak GP (OMM)
        </a>
        {dossier?.sources?.map((source) => (
          <a
            className="text-xs text-primary underline-offset-4 hover:underline"
            href={source.url}
            key={source.url}
            rel="noreferrer"
            target="_blank"
          >
            {source.name}
            {source.date ? ` · ${source.date}` : ""}
          </a>
        ))}
        {(!dossier?.sources || dossier.sources.length === 0) && (
          <p className="text-muted-foreground text-xs">No verified Cala sources yet.</p>
        )}
      </div>

      <div
        aria-hidden
        className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground"
      >
        <span
          className="size-2 rounded-full ring-1 ring-foreground/20"
          style={{ backgroundColor: dossier?.ownerColor || UNKNOWN_OWNER_COLOR }}
        />
        {dossier?.ownerColor ? "Verified owner color" : "Unknown owner"}
      </div>
    </aside>
  );
}
