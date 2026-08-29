const rgbCache = new Map<string, [number, number, number]>();
const FALLBACK: [number, number, number] = [0.886, 0.91, 0.941];

function hexToRgb(hex: string): [number, number, number] | null {
  let value = hex.replace("#", "").trim();
  if (value.length === 3) {
    value = value
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (value.length !== 6) return null;
  const n = Number.parseInt(value, 16);
  if (!Number.isFinite(n)) return null;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** CSS color → COBE `[r,g,b]` in 0–1. Used for Cala owner hues and hex greys. */
export function cssColorToRgb(color: string): [number, number, number] {
  const key = color.trim();
  const cached = rgbCache.get(key);
  if (cached) return cached;

  const fromHex = key.startsWith("#") ? hexToRgb(key) : null;
  if (fromHex) {
    rgbCache.set(key, fromHex);
    return fromHex;
  }

  if (typeof document === "undefined") return FALLBACK;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return FALLBACK;
  ctx.fillStyle = "#000000";
  ctx.fillStyle = key;
  const computed = String(ctx.fillStyle);
  const parsed = computed.startsWith("#") ? hexToRgb(computed) : null;
  const rgb = parsed ?? FALLBACK;
  rgbCache.set(key, rgb);
  return rgb;
}
