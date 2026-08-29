"use client";

import {
  enrichSatellites,
  type EnrichmentHalt,
} from "@/lib/cala";
import { noradKey } from "@/lib/orbit/omm";
import { overlayFromDossiers } from "@/lib/orbit/overlay";
import type { SatelliteOverlayMap, VisibleSatellite } from "@/lib/orbit/types";
import { useEffect, useRef, useState } from "react";

const BATCH = 80;

const UNREACHABLE_HALT: EnrichmentHalt = {
  code: "unreachable",
  message: "Cala is unreachable. Ownership enrichment paused.",
};

/**
 * Progressive Cala enrichment for visible payloads. Selected NORAD is sent
 * first. Dossiers map through `overlayFromDossiers` so dots stay grey until
 * `ownerColor` lands. Halt on Cala 429/unreachable/timeout/unconfigured —
 * do not keep retrying that batch. `halt` is set so the HUD can banner it.
 */
export function useCalaEnrichment(
  visible: VisibleSatellite[],
  selectedNoradId: string | null,
): { overlay: SatelliteOverlayMap; halt: EnrichmentHalt | null } {
  const [overlay, setOverlay] = useState<SatelliteOverlayMap>({});
  const [halt, setHalt] = useState<EnrichmentHalt | null>(null);
  const done = useRef(new Set<string>());
  const inflight = useRef(new Set<string>());
  const halted = useRef(false);
  const visibleRef = useRef(visible);

  const visibleKey = visible.map((sat) => sat.noradId).sort().join(",");
  const selected = selectedNoradId ?? "";

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (halted.current) return;
    let cancelled = false;

    async function tick() {
      for (let round = 0; round < 8 && !cancelled && !halted.current; round += 1) {
        const current = visibleRef.current;
        const needed = current.filter(
          (sat) => !done.current.has(sat.noradId) && !inflight.current.has(sat.noradId),
        );
        if (selectedNoradId) {
          const idx = needed.findIndex((sat) => sat.noradId === selectedNoradId);
          if (idx > 0) {
            const [picked] = needed.splice(idx, 1);
            if (picked) needed.unshift(picked);
          }
        }
        if (needed.length === 0) return;

        const batch = needed.slice(0, BATCH);
        for (const sat of batch) inflight.current.add(sat.noradId);

        try {
          const result = await enrichSatellites({
            selectedNoradId: selectedNoradId ?? undefined,
            satellites: batch.map((sat) => ({
              noradId: sat.noradId,
              name: sat.name,
            })),
          });
          if (cancelled) return;
          const mapped = overlayFromDossiers(result.dossiers);
          for (const dossier of result.dossiers) {
            done.current.add(noradKey(dossier.noradId));
          }
          setOverlay((prev) => ({ ...prev, ...mapped }));
          const stop = result.halted ?? result.error;
          if (stop) {
            halted.current = true;
            setHalt(stop);
            return;
          }
          if (result.skipped.length === 0 && result.dossiers.length === 0) return;
        } catch {
          if (!cancelled) {
            halted.current = true;
            setHalt(UNREACHABLE_HALT);
          }
          return;
        } finally {
          for (const sat of batch) inflight.current.delete(sat.noradId);
        }
      }
    }

    void tick();
    return () => {
      cancelled = true;
    };
  }, [visibleKey, selected, selectedNoradId]);

  return { overlay, halt };
}
