import type { SatPack } from "@/lib/cala";
import { constellationFromName } from "@/lib/orbit/constellation";
import type { SatelliteOverlay } from "@/lib/orbit/types";
import { wikiBriefFor, type WikiBrief } from "@/lib/orbit/wiki-dossiers";

type PackField = { value: string; sources: { name: string; url: string }[] };

function packSources(
  list?: Array<{ name: string; url: string; date?: string | null }> | null,
): { name: string; url: string }[] {
  if (!list?.length) return [];
  return list.flatMap((source) => {
    const name = source.name.trim();
    const url = source.url.trim();
    if (!name && !url) return [];
    return [{ name: name || url, url }];
  });
}

function calaWins(overlay?: SatelliteOverlay | null): boolean {
  if (!overlay || overlay.seeded === true) return false;
  return (
    overlay.evidenceState === "verified" ||
    overlay.evidenceState === "partial" ||
    Boolean(
      overlay.operator?.trim() ||
        overlay.ultimateParent?.trim() ||
        overlay.purpose?.trim(),
    )
  );
}

function sourcedField(
  overlayValue: string | null | undefined,
  wikiValue: string,
  overlaySources: { name: string; url: string }[],
  wikiSources: { name: string; url: string }[],
  preferOverlay: boolean,
): PackField | undefined {
  if (preferOverlay && overlayValue?.trim()) {
    return {
      value: overlayValue.trim(),
      sources: overlaySources.length > 0 ? overlaySources : wikiSources,
    };
  }
  const value = wikiValue.trim();
  if (!value) return undefined;
  return { value, sources: wikiSources };
}

function packImage(brief: WikiBrief): SatPack["image"] | undefined {
  if (!brief.image) return undefined;
  const sourceUrl =
    brief.sources.find((source) =>
      /wikipedia\.org|wikimedia\.org|nasa\.gov|esa\.int/i.test(source.url),
    )?.url ?? brief.sources[0]?.url;
  return {
    src: brief.image.url,
    alt: brief.image.alt,
    credit: brief.image.credit,
    sourceUrl,
  };
}

/**
 * Wiki brief + current Cala overlay for this object. Cala wins on sourced
 * fields; wiki blurb/image stay when Cala has none.
 */
export function packForSatellite(
  noradId: string,
  name: string,
  overlay?: SatelliteOverlay | null,
): SatPack {
  const brief = wikiBriefFor(name);
  const wikiSources = packSources(brief.sources);
  const overlaySources = packSources(overlay?.sources);
  const preferCala = calaWins(overlay);
  const blurb = overlay?.blurb?.trim() || brief.blurb.trim();

  return {
    noradId,
    name,
    constellation: constellationFromName(name),
    blurb: blurb || undefined,
    operator: sourcedField(
      overlay?.operator,
      brief.operator,
      overlaySources,
      wikiSources,
      preferCala,
    ),
    parent: sourcedField(
      overlay?.ultimateParent,
      brief.ultimateParent,
      overlaySources,
      wikiSources,
      preferCala,
    ),
    country: sourcedField(
      overlay?.country,
      brief.country,
      overlaySources,
      wikiSources,
      preferCala,
    ),
    purpose: sourcedField(
      overlay?.purpose,
      brief.purpose,
      overlaySources,
      wikiSources,
      preferCala,
    ),
    image: packImage(brief),
    evidenceState: overlay?.evidenceState ?? "unknown",
    seeded: overlay ? overlay.seeded === true : true,
  };
}
