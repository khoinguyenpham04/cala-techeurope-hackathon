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

export const EUROPEAN_CITIES: City[] = [
  { id: "barcelona", name: "Barcelona", country: "Spain", latitudeDeg: 41.3874, longitudeDeg: 2.1686, heightKm: 0.012 },
  { id: "madrid", name: "Madrid", country: "Spain", latitudeDeg: 40.4168, longitudeDeg: -3.7038, heightKm: 0.65 },
  { id: "lisbon", name: "Lisbon", country: "Portugal", latitudeDeg: 38.7223, longitudeDeg: -9.1393, heightKm: 0.002 },
  { id: "paris", name: "Paris", country: "France", latitudeDeg: 48.8566, longitudeDeg: 2.3522, heightKm: 0.035 },
  { id: "london", name: "London", country: "United Kingdom", latitudeDeg: 51.5074, longitudeDeg: -0.1278, heightKm: 0.011 },
  { id: "dublin", name: "Dublin", country: "Ireland", latitudeDeg: 53.3498, longitudeDeg: -6.2603, heightKm: 0.02 },
  { id: "amsterdam", name: "Amsterdam", country: "Netherlands", latitudeDeg: 52.3676, longitudeDeg: 4.9041, heightKm: 0.002 },
  { id: "brussels", name: "Brussels", country: "Belgium", latitudeDeg: 50.8503, longitudeDeg: 4.3517, heightKm: 0.013 },
  { id: "berlin", name: "Berlin", country: "Germany", latitudeDeg: 52.52, longitudeDeg: 13.405, heightKm: 0.034 },
  { id: "zurich", name: "Zurich", country: "Switzerland", latitudeDeg: 47.3769, longitudeDeg: 8.5417, heightKm: 0.408 },
  { id: "rome", name: "Rome", country: "Italy", latitudeDeg: 41.9028, longitudeDeg: 12.4964, heightKm: 0.021 },
  { id: "milan", name: "Milan", country: "Italy", latitudeDeg: 45.4642, longitudeDeg: 9.19, heightKm: 0.12 },
  { id: "vienna", name: "Vienna", country: "Austria", latitudeDeg: 48.2082, longitudeDeg: 16.3738, heightKm: 0.151 },
  { id: "prague", name: "Prague", country: "Czechia", latitudeDeg: 50.0755, longitudeDeg: 14.4378, heightKm: 0.2 },
  { id: "warsaw", name: "Warsaw", country: "Poland", latitudeDeg: 52.2297, longitudeDeg: 21.0122, heightKm: 0.1 },
  { id: "budapest", name: "Budapest", country: "Hungary", latitudeDeg: 47.4979, longitudeDeg: 19.0402, heightKm: 0.096 },
  { id: "athens", name: "Athens", country: "Greece", latitudeDeg: 37.9838, longitudeDeg: 23.7275, heightKm: 0.07 },
  { id: "stockholm", name: "Stockholm", country: "Sweden", latitudeDeg: 59.3293, longitudeDeg: 18.0686, heightKm: 0.028 },
  { id: "copenhagen", name: "Copenhagen", country: "Denmark", latitudeDeg: 55.6761, longitudeDeg: 12.5683, heightKm: 0.005 },
  { id: "oslo", name: "Oslo", country: "Norway", latitudeDeg: 59.9139, longitudeDeg: 10.7522, heightKm: 0.023 },
  { id: "helsinki", name: "Helsinki", country: "Finland", latitudeDeg: 60.1699, longitudeDeg: 24.9384, heightKm: 0.017 },
  { id: "bucharest", name: "Bucharest", country: "Romania", latitudeDeg: 44.4268, longitudeDeg: 26.1025, heightKm: 0.085 },
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
