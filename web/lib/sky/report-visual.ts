import {
  familyKeyFromName,
  wikiBriefFor,
} from "@/lib/orbit/wiki-dossiers";

/** Hero media for the identity card. Photos are cited Wikimedia thumbs only. */
export type ReportVisual = {
  kind: "photo" | "glyph";
  family: string;
  familyLabel: string;
  src?: string;
  alt: string;
  credit?: string;
  sourceUrl?: string;
  debris: boolean;
};

const FAMILY_LABEL: Record<string, string> = {
  ISS: "Space station",
  CSS: "Space station",
  CREW: "Crew Dragon",
  DRAGON: "Dragon",
  DEBRIS: "Orbital debris",
  FREGAT: "Spent stage",
  COSMOS: "Kosmos family",
  SENTINEL: "Copernicus",
  TERRA: "Earth observing",
  AQUA: "Earth observing",
  SOYUZ: "Crew ferry",
  PROGRESS: "Cargo ferry",
  CYGNUS: "Cargo ferry",
  USA: "Catalog designation",
};

export function isDebrisName(name: string): boolean {
  const family = familyKeyFromName(name);
  if (family === "DEBRIS" || family === "FREGAT") return true;
  const upper = name.toUpperCase();
  return upper.includes("R/B") || /\bDEB\b/.test(upper) || upper.endsWith(" DEB");
}

export function familyLabel(family: string): string {
  return FAMILY_LABEL[family] ?? `${family.replaceAll("-", " ")} family`;
}

export function shortOperatorName(value: string): string {
  const acronym = value.match(/\(([A-Z][A-Z0-9.&-]{1,10})\)/)?.[1];
  if (acronym) return acronym;
  const beforeParen = value.split("(")[0]?.trim() ?? value;
  if (beforeParen.length <= 36) return beforeParen;
  return beforeParen.split("/")[0]?.trim() || beforeParen;
}

export function visualForSatellite(name: string): ReportVisual {
  const family = familyKeyFromName(name) ?? "CATALOG";
  const brief = wikiBriefFor(name);
  const debris = isDebrisName(name);
  const image = brief.image;
  const wikiUrl = brief.sources.find((source) =>
    source.url.includes("wikipedia.org"),
  )?.url;

  if (image?.url) {
    return {
      kind: "photo",
      family,
      familyLabel: familyLabel(family),
      src: image.url,
      alt: image.alt,
      credit: image.credit,
      sourceUrl: wikiUrl ?? brief.sources[0]?.url,
      debris,
    };
  }

  return {
    kind: "glyph",
    family,
    familyLabel: familyLabel(family),
    alt: `${name} orbit illustration`,
    debris,
  };
}
