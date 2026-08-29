/**
 * CelesTrak name → constellation/operator key. Must stay aligned with
 * `agent/src/lib/cala.ts` `CONSTELLATION_HINTS` / `groupKey` so one Starlink
 * lookup paints every bird that shares the key.
 */

export type MatchKind = "satellite" | "constellation" | "operator";

export interface CatalogObjectLike {
  noradId: string;
  name?: string;
  constellation?: string;
}

export interface MegaSeed {
  operator: string;
  ultimateParent: string;
  purpose: string;
  colorKey: string;
  matchKind: MatchKind;
}

/**
 * Demo paint only — not Cala evidence. Overwritten when a sourced Cala
 * dossier arrives for this group key.
 */
export const MEGA_SEEDS: Record<string, MegaSeed> = {
  STARLINK: {
    operator: "SpaceX",
    ultimateParent: "SpaceX",
    purpose: "Satellite broadband",
    colorKey: "spacex-starlink",
    matchKind: "constellation",
  },
  ONEWEB: {
    operator: "Eutelsat OneWeb",
    ultimateParent: "Eutelsat",
    purpose: "Satellite broadband",
    colorKey: "eutelsat-oneweb",
    matchKind: "constellation",
  },
  ISS: {
    operator: "International Space Station",
    ultimateParent: "International Space Station",
    purpose: "Space station",
    colorKey: "iss-facility",
    matchKind: "satellite",
  },
  SENTINEL: {
    operator: "European Space Agency",
    ultimateParent: "European Space Agency",
    purpose: "Earth observation",
    colorKey: "esa-sentinel",
    matchKind: "constellation",
  },
};

const NAME_PREFIXES = [
  "STARLINK",
  "ONEWEB",
  "IRIDIUM",
  "GLOBALSTAR",
  "ORBCOMM",
  "NAVSTAR",
  "GLONASS",
  "GALILEO",
  "BEIDOU",
  "SENTINEL",
  "LANDSAT",
  "TIANGONG",
  "INTELSAT",
  "INMARSAT",
  "EUTELSAT",
  "METEOSAT",
  "HUBBLE",
  "YAOGAN",
  "GAOFEN",
  "KUIPER",
  "PLANET",
  "FLOCK",
  "SPIRE",
  "COSMOS",
  "METOP",
  "NOAA",
  "GOES",
  "GPS",
  "ISS",
  "CSS",
  "HST",
  "SES",
  "CREW DRAGON",
  "PROGRESS",
  "CYGNUS",
  "SHENZHOU",
  "TIANZHOU",
  "FREGAT",
  "DRAGON",
  "SOYUZ",
  "TERRA",
  "AQUA",
  "ENVISAT",
  "ALOS",
  "SEASAT",
  "HELIOS",
  "SAOCOM",
  "SPACEMOBILE",
  "ERS",
].sort((a, b) => b.length - a.length);

export function constellationFromName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const upper = name.toUpperCase();
  for (const prefix of NAME_PREFIXES) {
    if (
      upper === prefix ||
      upper.startsWith(`${prefix}-`) ||
      upper.startsWith(`${prefix} `) ||
      upper.startsWith(`${prefix}(`)
    ) {
      return prefix;
    }
    if (upper.includes(`(${prefix}`)) return prefix;
  }
  return undefined;
}

export function groupKey(object: CatalogObjectLike): string {
  const constellation = (object.constellation ?? constellationFromName(object.name))?.toUpperCase();
  if (constellation) return `constellation:${constellation}`;
  const cleaned = object.name?.replace(/\s+/g, " ").trim();
  if (cleaned) return `name:${cleaned.toUpperCase()}`;
  return `norad:${object.noradId}`;
}

export function megaSeedFor(object: CatalogObjectLike): MegaSeed | undefined {
  const constellation = (object.constellation ?? constellationFromName(object.name))?.toUpperCase();
  if (!constellation) return undefined;
  return MEGA_SEEDS[constellation];
}
