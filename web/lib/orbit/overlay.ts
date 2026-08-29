import { UNKNOWN_OWNER_COLOR } from "@/lib/orbit/constants";
import { noradKey } from "@/lib/orbit/omm";
import type {
  SatelliteOverlay,
  SatelliteOverlayMap,
  VisibleSatellite,
} from "@/lib/orbit/types";

/** Cala (or any enricher) row the globe can paint. */
export type OverlayDossier = {
  noradId: string;
  evidenceState?: SatelliteOverlay["evidenceState"];
  operator?: string | { value: string } | null;
  ultimateParent?: string | { value: string } | null;
  country?: string | { value: string } | null;
  purpose?: string | { value: string } | null;
  /** Explicit CSS color; wins over `colorKey` when set. */
  ownerColor?: string | null;
  /** Cala slug (hashed) or a CSS color. Ignored when evidence is `unknown`. */
  colorKey?: string | null;
  /** Catalog seed paint — not Cala evidence. Overwritten when sourced. */
  seeded?: boolean;
  sources?: SatelliteOverlay["sources"];
};

export function overlayFor(
  map: SatelliteOverlayMap | undefined,
  noradId: string | number,
): SatelliteOverlay | undefined {
  if (!map) return undefined;
  const key = noradKey(noradId);
  return map[key] ?? map[String(noradId)];
}

export function resolveDotColor(overlay?: SatelliteOverlay | null): string {
  const color = overlay?.ownerColor?.trim();
  return color && color.length > 0 ? color : UNKNOWN_OWNER_COLOR;
}

/**
 * Stable CSS color for globe dots. Cala sends a slug `colorKey` (ultimate
 * parent / operator); this hashes it so the same owner always gets the same hue.
 */
export function ownerColorFromKey(colorKey: string): string {
  let hash = 2166136261;
  for (let i = 0; i < colorKey.length; i += 1) {
    hash ^= colorKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hue = hash % 360;
  return `hsl(${hue} 58% 54%)`;
}

function fieldValue(
  field: string | { value: string } | null | undefined,
): string | null {
  if (!field) return null;
  if (typeof field === "string") {
    const trimmed = field.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  const trimmed = field.value?.trim();
  return trimmed ? trimmed : null;
}

function looksLikeCssColor(value: string): boolean {
  return (
    value.startsWith("#") ||
    value.startsWith("hsl") ||
    value.startsWith("rgb") ||
    value.startsWith("oklch")
  );
}

function ownerColorFor(row: OverlayDossier): string | null {
  if (row.evidenceState === "unknown" && !row.seeded) return null;
  const explicit = row.ownerColor?.trim();
  if (explicit) return explicit;
  const key = row.colorKey?.trim();
  if (!key) return null;
  return looksLikeCssColor(key) ? key : ownerColorFromKey(key);
}

/**
 * Single Cala → globe overlay mapper. Dots stay grey until `ownerColor` is
 * set (verified/partial dossier with a color key). Unknowns stay in the
 * headline denominator because they never get a parent label here either.
 */
export function overlayFromDossiers(dossiers: OverlayDossier[]): SatelliteOverlayMap {
  const map: SatelliteOverlayMap = {};
  for (const row of dossiers) {
    map[noradKey(row.noradId)] = {
      ownerColor: ownerColorFor(row),
      ultimateParent: fieldValue(row.ultimateParent),
      operator: fieldValue(row.operator),
      country: fieldValue(row.country),
      purpose: fieldValue(row.purpose),
      evidenceState: row.evidenceState,
      seeded: row.seeded === true,
      sources: row.sources?.map((source) => ({
        name: source.name,
        url: source.url,
        date: source.date ?? null,
      })),
    };
  }
  return map;
}

/**
 * Headline counter: top verified ultimate-parent count / all visible payloads.
 * Unknowns stay in the denominator. Until Cala attaches overlays this is 0 / N.
 */
export function headlineCounter(
  visible: VisibleSatellite[],
  overlay?: SatelliteOverlayMap,
): { topCount: number; total: number; parent: string | null } {
  const total = visible.length;
  if (!overlay || total === 0) {
    return { topCount: 0, total, parent: null };
  }

  const counts = new Map<string, number>();
  for (const sat of visible) {
    const parent = overlayFor(overlay, sat.noradId)?.ultimateParent?.trim();
    if (!parent) continue;
    counts.set(parent, (counts.get(parent) ?? 0) + 1);
  }

  let topCount = 0;
  let parent: string | null = null;
  for (const [name, count] of counts) {
    if (count > topCount) {
      topCount = count;
      parent = name;
    }
  }
  return { topCount, total, parent };
}

export function ownerLegend(
  visible: VisibleSatellite[],
  overlay?: SatelliteOverlayMap,
  limit = 5,
): Array<{ label: string; color: string; count: number }> {
  if (!overlay) return [];
  const counts = new Map<string, { label: string; color: string; count: number }>();
  for (const sat of visible) {
    const entry = overlayFor(overlay, sat.noradId);
    const color = entry?.ownerColor?.trim();
    const label = entry?.ultimateParent?.trim() || entry?.operator?.trim();
    if (!color || !label) continue;
    const current = counts.get(label);
    if (current) current.count += 1;
    else counts.set(label, { label, color, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
