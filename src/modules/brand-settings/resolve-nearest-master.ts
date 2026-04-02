import { getMasterPalette } from "@/modules/palette/services/palette-service";

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

export function parseHexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(HEX_RE);
  if (!m) return null;
  const n = m[1]!;
  return {
    r: Number.parseInt(n.slice(0, 2), 16),
    g: Number.parseInt(n.slice(2, 4), 16),
    b: Number.parseInt(n.slice(4, 6), 16),
  };
}

export function normalizeHex6(hex: string): string | null {
  const rgb = parseHexToRgb(hex);
  if (!rgb) return null;
  const to2 = (x: number) => x.toString(16).padStart(2, "0");
  return `#${to2(rgb.r)}${to2(rgb.g)}${to2(rgb.b)}`.toLowerCase();
}

/** Picks the MARD master id whose RGB is closest in Euclidean distance. */
export function resolveNearestMasterId(r: number, g: number, b: number): string {
  let bestId = "A1";
  let bestD = Infinity;
  for (const c of getMasterPalette()) {
    const d = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
    if (d < bestD) {
      bestD = d;
      bestId = c.id;
    }
  }
  return bestId;
}
