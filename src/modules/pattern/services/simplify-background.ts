import { mergeSmallRegions } from "@/modules/pattern/services/merge-small-regions";
import type { PatternCell } from "@/types";

/**
 * 边缘带内更激进的小区域合并（不做语义分割）。
 * 使用略高于全局阈值的面积上限，且仅合并完全落在边缘 mask 内的连通块。
 */
export function simplifyBackgroundEdgeRegions(params: {
  cells: PatternCell[][];
  smallRegionAreaThreshold: number;
  /** 相对短边的比例，默认 0.15 */
  edgeBandRatio?: number;
}): { cells: PatternCell[][]; regionsMergedCount: number } {
  const { cells, smallRegionAreaThreshold, edgeBandRatio = 0.15 } = params;
  const h = cells.length;
  const w = cells[0]?.length ?? 0;
  if (h === 0 || w === 0) {
    return { cells: cells.map((row) => row.map((c) => ({ ...c }))), regionsMergedCount: 0 };
  }

  const band = Math.max(
    1,
    Math.floor(Math.min(w, h) * edgeBandRatio),
  );
  const mask: boolean[][] = [];
  for (let y = 0; y < h; y += 1) {
    const row: boolean[] = [];
    for (let x = 0; x < w; x += 1) {
      const edge =
        x < band || y < band || x >= w - band || y >= h - band;
      row.push(edge);
    }
    mask.push(row);
  }

  const boosted = Math.max(
    smallRegionAreaThreshold + 2,
    Math.ceil(smallRegionAreaThreshold * 1.5),
  );

  return mergeSmallRegions({
    cells,
    areaThreshold: boosted,
    restrictToMask: mask,
  });
}
