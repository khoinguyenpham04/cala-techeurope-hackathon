"use client";

import { GlobeWorkspace } from "@/components/sky/globe-workspace";
import { SkyProvider } from "@/components/sky/sky-context";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cityById, defaultCity } from "@/lib/geo/cities";
import { noradKey } from "@/lib/orbit/omm";
import { useOrbitCatalog } from "@/hooks/use-orbit-catalog";
import { useOrbitWorker } from "@/hooks/use-orbit-worker";
import { useCalaEnrichment } from "@/hooks/use-cala-enrichment";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { type ReactNode, useCallback, useMemo, useState } from "react";

export function SkyConsole({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [cityId, setCityId] = useState(defaultCity().id);
  const [noradId, setNoradId] = useState<string | null>(null);
  const city = cityById(cityId);

  const { catalog, loading } = useOrbitCatalog();
  const observer = useMemo(
    () => ({
      latitudeDeg: city.latitudeDeg,
      longitudeDeg: city.longitudeDeg,
      heightKm: city.heightKm,
    }),
    [city.heightKm, city.latitudeDeg, city.longitudeDeg],
  );
  // Keep the full catalog available for the guaranteed demo pick. The city
  // horizon remains one explicit toggle away.
  const [horizonOnly, setHorizonOnly] = useState(false);
  const { visible, error: workerError } = useOrbitWorker(
    catalog?.records,
    observer,
    horizonOnly,
  );
  const { overlay, halt: enrichmentHalt } = useCalaEnrichment(visible, noradId);
  const setCity = useCallback((id: string) => {
    setCityId(id);
  }, []);
  const demoNoradId = useMemo(() => {
    const record = catalog?.records.find((row) => /^ISS \(ZARYA\)$/i.test(row.OBJECT_NAME));
    return record ? noradKey(record.NORAD_CAT_ID) : null;
  }, [catalog?.records]);
  const selectDemo = useCallback(() => {
    if (!demoNoradId) return;
    setHorizonOnly(false);
    setNoradId(demoNoradId);
  }, [demoNoradId]);

  const selected = visible.find((sat) => sat.noradId === noradId) ?? null;
  const selectedOmm = useMemo(() => {
    if (!noradId || !catalog?.records) return null;
    return catalog.records.find((row) => noradKey(row.NORAD_CAT_ID) === noradId) ?? null;
  }, [catalog?.records, noradId]);

  const globe = (
    <GlobeWorkspace
      city={city}
      enrichmentHalt={enrichmentHalt}
      loading={loading}
      horizonOnly={horizonOnly}
      onHorizonOnlyChange={setHorizonOnly}
      onDemoPick={selectDemo}
      onSelect={setNoradId}
      overlay={overlay}
      selected={selected}
      selectedNoradId={noradId}
      selectedOmm={selectedOmm}
      showSidebarTrigger={!isMobile}
      source={catalog?.source}
      stale={Boolean(catalog?.stale)}
      visible={visible}
      workerError={workerError}
    />
  );

  const chat = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      {children}
    </div>
  );

  return (
    <SkyProvider
      value={{
        city,
        noradId,
        overlay,
        satellite: selected,
        setCityId: setCity,
        setNoradId,
        visible,
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
      {isMobile ? (
        <Tabs
          className="flex min-h-0 flex-1 flex-col gap-0"
          defaultValue="sky"
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <SidebarTrigger className="-ml-1" />
            <p className="min-w-0 flex-1 truncate font-medium text-sm">Skyla</p>
            <TabsList className="h-8">
              <TabsTrigger value="sky">Sky</TabsTrigger>
              <TabsTrigger value="ask">Ask</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
            value="sky"
          >
            {globe}
          </TabsContent>
          <TabsContent
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
            value="ask"
          >
            {chat}
          </TabsContent>
        </Tabs>
      ) : (
        <ResizablePanelGroup className="min-h-0 flex-1" orientation="horizontal">
          <ResizablePanel className="min-h-0" defaultSize="65" minSize="42">
            <div className={cn("flex h-full min-h-0 flex-col")}>{globe}</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel className="min-h-0" defaultSize="35" minSize="26">
            <div className="flex h-full min-h-0 flex-col overflow-hidden">{chat}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
      </div>
    </SkyProvider>
  );
}
