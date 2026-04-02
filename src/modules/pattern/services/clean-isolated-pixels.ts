import type { PatternCell } from "@/types";

function cloneCells(cells: PatternCell[][]): PatternCell[][] {
  return cells.map((row) => row.map((c) => ({ ...c })));
}

const DIRS4: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * 四邻域全为同色且与中心不同时，将中心改为该色（单格孤立点）。
 */
export function cleanIsolatedSinglePixels(cells: PatternCell[][]): PatternCell[][] {
  const h = cells.length;
  const w = cells[0]?.length ?? 0;
  if (w === 0 || h === 0) return cloneCells(cells);

  const out = cloneCells(cells);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const center = out[y][x].masterColorId;
      if (center === null) continue;

      const neighborColors: string[] = [];
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const nid = out[ny][nx].masterColorId;
        if (nid !== null) neighborColors.push(nid);
      }

      if (neighborColors.length < 4) continue;

      const first = neighborColors[0];
      if (!neighborColors.every((c) => c === first)) continue;
      if (first === center) continue;

      out[y][x] = { ...out[y][x], masterColorId: first };
    }
  }

  return out;
}
