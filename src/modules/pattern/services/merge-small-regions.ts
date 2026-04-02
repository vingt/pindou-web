import type { PatternCell } from "@/types";

function cloneCells(cells: PatternCell[][]): PatternCell[][] {
  return cells.map((row) => row.map((c) => ({ ...c })));
}

type Pt = { x: number; y: number };

function neighborMajorityColor(
  cells: PatternCell[][],
  region: Pt[],
  height: number,
  width: number,
): string | null {
  const inRegion = new Set(region.map((p) => `${p.x},${p.y}`));
  const tally = new Map<string, number>();

  for (const { x, y } of region) {
    const neigh: Pt[] = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 },
    ];
    for (const { x: nx, y: ny } of neigh) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (inRegion.has(`${nx},${ny}`)) continue;
      const id = cells[ny][nx].masterColorId;
      if (id === null) continue;
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
  }

  if (tally.size === 0) return null;

  let bestId: string | null = null;
  let bestN = -1;
  for (const [id, n] of tally) {
    if (n > bestN || (n === bestN && bestId !== null && id.localeCompare(bestId) < 0)) {
      bestN = n;
      bestId = id;
    }
  }
  return bestId;
}

function floodFillSameColor(
  cells: PatternCell[][],
  startX: number,
  startY: number,
  height: number,
  width: number,
  visited: boolean[][],
): Pt[] {
  const seedId = cells[startY][startX].masterColorId;
  if (seedId === null) return [];

  const region: Pt[] = [];
  const stack: Pt[] = [{ x: startX, y: startY }];

  while (stack.length > 0) {
    const p = stack.pop()!;
    if (p.x < 0 || p.x >= width || p.y < 0 || p.y >= height) continue;
    if (visited[p.y][p.x]) continue;
    if (cells[p.y][p.x].masterColorId !== seedId) continue;

    visited[p.y][p.x] = true;
    region.push(p);
    stack.push(
      { x: p.x - 1, y: p.y },
      { x: p.x + 1, y: p.y },
      { x: p.x, y: p.y - 1 },
      { x: p.x, y: p.y + 1 },
    );
  }

  return region;
}

/**
 * 四邻域连通区域面积 ≤ threshold 时，整块替换为边界上出现最多的邻居色。
 */
export function mergeSmallRegions(params: {
  cells: PatternCell[][];
  areaThreshold: number;
  /** 若提供，仅当区域内所有格均为 true 时才尝试合并 */
  restrictToMask?: boolean[][];
}): { cells: PatternCell[][]; regionsMergedCount: number } {
  const { cells, areaThreshold, restrictToMask } = params;
  if (areaThreshold < 1 || cells.length === 0) {
    return { cells: cloneCells(cells), regionsMergedCount: 0 };
  }

  const height = cells.length;
  const width = cells[0]?.length ?? 0;
  if (width === 0) {
    return { cells: cloneCells(cells), regionsMergedCount: 0 };
  }

  const working = cloneCells(cells);
  const visited: boolean[][] = Array.from({ length: height }, () =>
    Array<boolean>(width).fill(false),
  );

  let regionsMergedCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (visited[y][x]) continue;

      if (working[y][x].masterColorId === null) {
        visited[y][x] = true;
        continue;
      }

      const region = floodFillSameColor(working, x, y, height, width, visited);
      const seedId = working[y][x].masterColorId;
      if (region.length === 0 || seedId === null) continue;

      if (region.length > areaThreshold) continue;

      if (restrictToMask) {
        const mask = restrictToMask;
        const allIn =
          region.length > 0 &&
          region.every((p) => {
            const row = mask[p.y];
            return Boolean(row && row[p.x]);
          });
        if (!allIn) continue;
      }

      const replaceWith = neighborMajorityColor(working, region, height, width);
      if (replaceWith === null || replaceWith === seedId) continue;

      for (const p of region) {
        working[p.y][p.x] = {
          ...working[p.y][p.x],
          masterColorId: replaceWith,
        };
      }
      regionsMergedCount += 1;
    }
  }

  return { cells: working, regionsMergedCount };
}
