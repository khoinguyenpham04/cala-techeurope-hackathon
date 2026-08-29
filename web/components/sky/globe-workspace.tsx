"use client";

import { GlobeCanvas } from "@/components/sky/globe-canvas";
import { SkyHud } from "@/components/sky/sky-hud";
import type { EnrichmentHalt } from "@/lib/cala";
import type { City } from "@/lib/geo/cities";
import type {
  CatalogSource,
  SatelliteOverlayMap,
  SlimOmm,
  VisibleSatellite,
} from "@/lib/orbit/types";

export function GlobeWorkspace({
  city,
  visible,
  overlay,
  selected,
  selectedNoradId,
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
  selectedNoradId: string | null;
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
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[#05070c]">
      <GlobeCanvas
        city={city}
        onSelect={onSelect}
        overlay={overlay}
        selectedNoradId={selectedNoradId}
        selectedOmm={selectedOmm}
        visible={visible}
      />
      <SkyHud
        city={city}
        enrichmentHalt={enrichmentHalt}
        horizonOnly={horizonOnly}
        loading={loading}
        onHorizonOnlyChange={onHorizonOnlyChange}
        onDemoPick={onDemoPick}
        onSelect={onSelect}
        overlay={overlay}
        selected={selected}
        selectedOmm={selectedOmm}
        showSidebarTrigger={showSidebarTrigger}
        source={source}
        stale={stale}
        visible={visible}
        workerError={workerError}
      />
    </div>
  );
}
