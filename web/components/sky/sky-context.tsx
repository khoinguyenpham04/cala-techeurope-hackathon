"use client";

import type { City } from "@/lib/geo/cities";
import type { SatelliteOverlayMap, VisibleSatellite } from "@/lib/orbit/types";
import { createContext, useContext, type ReactNode } from "react";

export interface SkySelection {
  city: City;
  noradId: string | null;
  satellite: VisibleSatellite | null;
  visible: VisibleSatellite[];
  overlay: SatelliteOverlayMap;
  setNoradId: (noradId: string | null) => void;
  setCityId: (cityId: string) => void;
}

const SkyContext = createContext<SkySelection | null>(null);

export function SkyProvider({
  value,
  children,
}: {
  value: SkySelection;
  children: ReactNode;
}) {
  return <SkyContext.Provider value={value}>{children}</SkyContext.Provider>;
}

export function useSkySelection(): SkySelection | null {
  return useContext(SkyContext);
}
