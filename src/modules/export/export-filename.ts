import type { BrandId, PresetTier } from "@/types";

export function buildPatternExportBasename(
  brand: BrandId,
  tier: PresetTier,
  gridW: number,
  gridH: number,
): string {
  return `${brand}_${tier}_${gridW}x${gridH}_pattern`;
}
