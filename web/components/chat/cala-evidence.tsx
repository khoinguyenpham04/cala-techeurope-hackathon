"use client";

import { Badge } from "@/components/ui/badge";
import { EMPTY_CALA_MESSAGE, type SatelliteDossier, type SourcedField } from "@/lib/cala";
import { cn } from "@/lib/utils";

function FieldRow({
  label,
  field,
}: {
  label: string;
  field: SourcedField | undefined;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">
        {field?.value ? (
          <span className="truncate">{field.value}</span>
        ) : (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            unknown
          </Badge>
        )}
      </dd>
    </div>
  );
}

export function CalaEvidence({
  dossier,
  className,
}: {
  dossier: SatelliteDossier;
  className?: string;
}) {
  const empty = dossier.evidenceState === "unknown";
  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/40 px-3 py-2.5",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
          Cala evidence
        </p>
        <Badge
          variant={empty ? "outline" : dossier.evidenceState === "verified" ? "default" : "secondary"}
          className="capitalize"
        >
          {dossier.evidenceState}
        </Badge>
      </div>
      {empty ? (
        <p className="text-muted-foreground text-sm">{EMPTY_CALA_MESSAGE}</p>
      ) : (
        <dl className="flex flex-col gap-1.5">
          <FieldRow field={dossier.operator} label="Operator" />
          <FieldRow field={dossier.ultimateParent} label="Ultimate parent" />
          <FieldRow field={dossier.country} label="Country" />
          <FieldRow field={dossier.purpose} label="Purpose" />
        </dl>
      )}
    </div>
  );
}
