import { DEFAULT_CITY_ID } from "@/lib/orbit/constants";

export interface City {
  id: string;
  name: string;
  country: string;
  latitudeDeg: number;
  longitudeDeg: number;
  /** Approximate ellipsoid height, km. */
  heightKm: number;
}

/** Hackathon demo is Barcelona-only. */
export const EUROPEAN_CITIES: City[] = [
  { id: "barcelona", name: "Barcelona", country: "Spain", latitudeDeg: 41.3874, longitudeDeg: 2.1686, heightKm: 0.012 },
];

export function cityById(id: string): City {
  return EUROPEAN_CITIES.find((city) => city.id === id) ?? EUROPEAN_CITIES[0]!;
}

export function defaultCity(): City {
  return cityById(DEFAULT_CITY_ID);
}

/** Resolve a saved session city (id or display name). No fallback. */
export function cityFromSession(value: string | undefined): City | undefined {
  const needle = value?.trim().toLowerCase();
  if (!needle) return undefined;
  return EUROPEAN_CITIES.find(
    (city) => city.id === needle || city.name.toLowerCase() === needle,
  );
}
