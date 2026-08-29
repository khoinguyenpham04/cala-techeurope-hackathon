"use client";

import {
  enrichSatellites,
  type EnrichmentHalt,
} from "@/lib/cala";
import { noradKey } from "@/lib/orbit/omm";
import { overlayFromDossiers } from "@/lib/orbit/overlay";
import type { SatelliteOverlay, SatelliteOverlayMap, VisibleSatellite } from "@/lib/orbit/types";
import { wikiOverlayFor } from "@/lib/orbit/wiki-dossiers";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const [calaOverlay, setCalaOverlay] = useState<SatelliteOverlayMap>({});
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
          setCalaOverlay((prev) => ({ ...prev, ...mapped }));
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

  // A user selection may still be served from the local Cala graph after live
  // enrichment has halted. This is what keeps the sourced demo path available
  // during a 429 without retrying the full background batch.
  useEffect(() => {
    if (!selectedNoradId || done.current.has(selectedNoradId)) return;
    if (inflight.current.has(selectedNoradId)) return;
    const satellite = visibleRef.current.find(
      (entry) => entry.noradId === selectedNoradId,
    );
    if (!satellite) return;

    let cancelled = false;
    inflight.current.add(selectedNoradId);
    void enrichSatellites({
      selectedNoradId,
      satellites: [{ noradId: satellite.noradId, name: satellite.name }],
    })
      .then((result) => {
        if (cancelled || result.dossiers.length === 0) return;
        const mapped = overlayFromDossiers(result.dossiers);
        for (const dossier of result.dossiers) {
          done.current.add(noradKey(dossier.noradId));
        }
        setCalaOverlay((previous) => ({ ...previous, ...mapped }));
      })
      .finally(() => {
        inflight.current.delete(selectedNoradId);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNoradId, visibleKey]);

  const wiki = useMemo(() => wikiOverlayFor(visible), [visible, visibleKey]);
  const overlay = useMemo(
    () => mergeWikiAndCala(wiki, calaOverlay),
    [wiki, calaOverlay],
  );

  return { overlay, halt };
}

function calaHasClaim(row: SatelliteOverlay): boolean {
  return (
    row.evidenceState === "verified" ||
    row.evidenceState === "partial" ||
    (row.seeded !== true &&
      Boolean(row.operator?.trim() || row.ultimateParent?.trim() || row.purpose?.trim()))
  );
}

function mergeWikiAndCala(
  wiki: SatelliteOverlayMap,
  cala: SatelliteOverlayMap,
): SatelliteOverlayMap {
  const merged: SatelliteOverlayMap = { ...wiki };
  for (const [noradId, row] of Object.entries(cala)) {
    const base = wiki[noradId];
    if (!calaHasClaim(row)) {
      if (base) {
        merged[noradId] = {
          ...base,
          sources: row.sources?.length ? row.sources : base.sources,
        };
      }
      continue;
    }
    merged[noradId] = {
      ...base,
      ...row,
      blurb: row.blurb ?? base?.blurb,
      seeded: false,
    };
  }
  return merged;
}
