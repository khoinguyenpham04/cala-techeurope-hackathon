"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { VisibleSatellite } from "@/lib/orbit/types";

function formatSpeedKmh(speedKmS: number) {
  const kmh = speedKmS * 3600;
  return `${Math.round(kmh).toLocaleString("en-US")} km/h`;
}

function formatKm(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} km`;
}

function formatDeg(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}°`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] tabular-nums">
      <span className="text-sky-400">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export function SatelliteTelemetry({ satellite }: { satellite: VisibleSatellite }) {
  return (
    <Card
      className="pointer-events-auto w-[min(100%,16.5rem)] gap-2 bg-card/80 py-2.5 shadow-lg backdrop-blur-md"
      size="sm"
    >
      <CardHeader className="px-3">
        <CardTitle className="truncate font-medium text-[13px] text-sky-300 leading-tight">
          {satellite.name}{" "}
          <span className="font-mono text-[11px] text-foreground/80">#{satellite.noradId}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-3 pb-1">
        <Row label="Speed" value={formatSpeedKmh(satellite.speedKmS)} />
        <Row label="Height" value={formatKm(satellite.altitudeKm)} />
        <Row label="Latitude" value={formatDeg(satellite.latitudeDeg)} />
        <Row label="Longitude" value={formatDeg(satellite.longitudeDeg)} />
      </CardContent>
    </Card>
  );
}
