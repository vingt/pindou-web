import { getBrandCode, getMasterColorById } from "@/modules/palette/services";
import type { BrandId } from "@/types";
import type { ColorUsageStat } from "@/types/export";
import type { PatternGenerationResult } from "@/types/pattern";

/**
 * 从 generationResult.cells 扫描得到每色颗数，并附上当前品牌色号与 master hex。
 */
export function buildColorUsageStats(
  result: PatternGenerationResult,
  brand: BrandId,
): ColorUsageStat[] {
  const counts = new Map<string, number>();
  for (const row of result.cells) {
    for (const cell of row) {
      if (cell.masterColorId === null) continue;
      counts.set(cell.masterColorId, (counts.get(cell.masterColorId) ?? 0) + 1);
    }
  }
  const stats: ColorUsageStat[] = [];
  for (const [masterId, count] of counts) {
    const master = getMasterColorById(masterId);
    stats.push({
      masterId,
      count,
      brandCode: getBrandCode(brand, masterId),
      hex: master?.hex ?? "#ffffff",
    });
  }
  stats.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.masterId.localeCompare(b.masterId);
  });
  return stats;
}
