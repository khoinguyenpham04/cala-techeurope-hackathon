"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { UNKNOWN_OWNER_COLOR } from "@/lib/orbit/constants";
import { overlayFor } from "@/lib/orbit/overlay";
import type { SatelliteOverlayMap, SlimOmm, VisibleSatellite } from "@/lib/orbit/types";
import { XIcon } from "@phosphor-icons/react";

function formatKm(value: number, digits = 1) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })} km`;
}

function formatDeg(value: number, digits = 2) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })}°`;
}

function formatSpeedKmh(speedKmS: number) {
  return `${Math.round(speedKmS * 3600).toLocaleString("en-US")} km/h`;
}

function formatEpoch(epoch: string) {
  const parsed = Date.parse(epoch);
  if (!Number.isFinite(parsed)) return epoch;
  return `${new Date(parsed).toISOString().replace(".000Z", "").replace("T", " ")} UTC`;
}

function formatPeriod(meanMotion: number) {
  if (!(meanMotion > 0)) return "—";
  const minutes = 1440 / meanMotion;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes - hours * 60);
  if (hours <= 0) return `${mins} minute${mins === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"}, ${mins} minute${mins === 1 ? "" : "s"}`;
}

function ommDump(omm: SlimOmm) {
  return [
    omm.OBJECT_NAME,
    `OBJECT_ID   ${omm.OBJECT_ID}`,
    `NORAD       ${omm.NORAD_CAT_ID}`,
    `EPOCH       ${omm.EPOCH}`,
    `INCL        ${omm.INCLINATION.toFixed(4)} deg`,
    `ECC         ${omm.ECCENTRICITY.toFixed(7)}`,
    `MM          ${omm.MEAN_MOTION.toFixed(8)} rev/day`,
    `RAAN        ${omm.RA_OF_ASC_NODE.toFixed(4)} deg`,
    `ARGP        ${omm.ARG_OF_PERICENTER.toFixed(4)} deg`,
    `MA          ${omm.MEAN_ANOMALY.toFixed(4)} deg`,
  ].join("\n");
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] text-sky-400">{label}</dt>
      <dd className="text-right font-mono text-[12px] text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

export function SatelliteInspector({
  satellite,
  omm,
  overlay,
  onClose,
}: {
  satellite: VisibleSatellite;
  omm: SlimOmm | null;
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
    <Card
      className="pointer-events-auto flex h-full w-[min(100%,18.5rem)] gap-0 bg-card/85 py-0 shadow-lg backdrop-blur-md"
      size="sm"
    >
      <CardHeader className="border-b px-3 py-2.5">
        <CardTitle className="truncate font-medium text-base leading-tight">
          {satellite.name}
        </CardTitle>
        <CardAction>
          <Button
            aria-label="Clear selection"
            className="size-7"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            <XIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-0 py-0">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-3 px-3 py-3">
            {omm ? (
              <pre className="overflow-x-auto rounded-md bg-black/50 p-2 font-mono text-[10px] leading-relaxed text-sky-100/90">
                {ommDump(omm)}
              </pre>
            ) : null}

            <dl className="flex flex-col gap-1.5">
              <Field label="NORAD ID" value={satellite.noradId} />
              <Field label="Name" value={satellite.name} />
              {omm ? <Field label="Epoch" value={formatEpoch(omm.EPOCH)} /> : null}
              <Field label="Speed" value={formatSpeedKmh(satellite.speedKmS)} />
              <Field label="Height" value={formatKm(satellite.altitudeKm, 0)} />
              <Field label="Latitude" value={formatDeg(satellite.latitudeDeg)} />
              <Field label="Longitude" value={formatDeg(satellite.longitudeDeg)} />
              {omm ? (
                <>
                  <Field label="Inclination" value={formatDeg(omm.INCLINATION)} />
                  <Field
                    label="Mean Motion"
                    value={`${omm.MEAN_MOTION.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} rev/day`}
                  />
                  <Field label="Orbital Period" value={formatPeriod(omm.MEAN_MOTION)} />
                  <Field
                    label="Eccentricity"
                    value={omm.ECCENTRICITY.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                  />
                  <Field label="RAAN" value={formatDeg(omm.RA_OF_ASC_NODE)} />
                  <Field label="Argument of Perigee" value={formatDeg(omm.ARG_OF_PERICENTER)} />
                  <Field label="Mean Anomaly" value={formatDeg(omm.MEAN_ANOMALY)} />
                </>
              ) : null}
            </dl>

            <Separator />

            <dl className="flex flex-col gap-1.5">
              <Field label="Operator" value={operator} />
              <Field label="Parent" value={parent} />
              <Field label="Purpose" value={purpose} />
              <Field label="Evidence" value={evidence} />
            </dl>

            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Sources
              </p>
              <a
                className="text-xs text-sky-400 underline-offset-4 hover:underline"
                href={catalogUrl}
                rel="noreferrer"
                target="_blank"
              >
                CelesTrak GP (OMM)
              </a>
              {dossier?.sources?.map((source) => (
                <a
                  className="text-xs text-sky-400 underline-offset-4 hover:underline"
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

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span
                className="size-2 rounded-full ring-1 ring-foreground/20"
                style={{ backgroundColor: dossier?.ownerColor || UNKNOWN_OWNER_COLOR }}
              />
              {dossier?.ownerColor ? "Verified owner color" : "Unknown owner"}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
