import type { DitheringMode } from "@/types";
import type { PatternCell } from "@/types";

export type Rgb = { r: number; g: number; b: number };

export type MasterCandidate = { id: string; r: number; g: number; b: number };

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, n));
}

function distanceSquared(a: Rgb, b: MasterCandidate): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

export function findNearestMasterColor(
  rgb: Rgb,
  candidates: MasterCandidate[],
): MasterCandidate {
  let best = candidates[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const d = distanceSquared(rgb, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

/** 4×4 Bayer，强度约 ±24（0–255 空间）。 */
const BAYER_4: number[][] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function bayerOffset(x: number, y: number): number {
  const v = BAYER_4[y % 4][x % 4];
  return (v / 16 - 0.5) * 48;
}

type FloatRow = { r: number; g: number; b: number }[][];

function cloneRgbToFloat(rows: Rgb[][]): FloatRow {
  return rows.map((row) => row.map((p) => ({ r: p.r, g: p.g, b: p.b })));
}

function addError(
  buf: FloatRow,
  x: number,
  y: number,
  er: number,
  eg: number,
  eb: number,
  w: number,
  h: number,
) {
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  buf[y][x].r += er;
  buf[y][x].g += eg;
  buf[y][x].b += eb;
}

/**
 * 抖动 + 最近邻量化到 master 候选，输出 cells（仅 masterColorId）。
 */
export function ditherAndQuantizeToCells(
  rgbRows: Rgb[][],
  candidates: MasterCandidate[],
  dithering: DitheringMode,
): PatternCell[][] {
  const height = rgbRows.length;
  const width = rgbRows[0]?.length ?? 0;
  if (width === 0 || height === 0) return [];

  if (dithering === "none") {
    const cells: PatternCell[][] = [];
    for (let y = 0; y < height; y += 1) {
      const row: PatternCell[] = [];
      for (let x = 0; x < width; x += 1) {
        const nearest = findNearestMasterColor(rgbRows[y][x], candidates);
        row.push({ x, y, masterColorId: nearest.id });
      }
      cells.push(row);
    }
    return cells;
  }

  if (dithering === "bayer") {
    const cells: PatternCell[][] = [];
    for (let y = 0; y < height; y += 1) {
      const row: PatternCell[] = [];
      for (let x = 0; x < width; x += 1) {
        const o = bayerOffset(x, y);
        const p = rgbRows[y][x];
        const adj: Rgb = {
          r: clamp255(p.r + o),
          g: clamp255(p.g + o),
          b: clamp255(p.b + o),
        };
        const nearest = findNearestMasterColor(adj, candidates);
        row.push({ x, y, masterColorId: nearest.id });
      }
      cells.push(row);
    }
    return cells;
  }

  const buf = cloneRgbToFloat(rgbRows);
  const cells: PatternCell[][] = [];

  for (let y = 0; y < height; y += 1) {
    const row: PatternCell[] = [];
    for (let x = 0; x < width; x += 1) {
      const oldR = clamp255(buf[y][x].r);
      const oldG = clamp255(buf[y][x].g);
      const oldB = clamp255(buf[y][x].b);
      const nearest = findNearestMasterColor(
        { r: oldR, g: oldG, b: oldB },
        candidates,
      );
      row.push({ x, y, masterColorId: nearest.id });

      const er = oldR - nearest.r;
      const eg = oldG - nearest.g;
      const eb = oldB - nearest.b;

      if (dithering === "floyd-steinberg") {
        addError(buf, x + 1, y, er * (7 / 16), eg * (7 / 16), eb * (7 / 16), width, height);
        addError(buf, x - 1, y + 1, er * (3 / 16), eg * (3 / 16), eb * (3 / 16), width, height);
        addError(buf, x, y + 1, er * (5 / 16), eg * (5 / 16), eb * (5 / 16), width, height);
        addError(buf, x + 1, y + 1, er * (1 / 16), eg * (1 / 16), eb * (1 / 16), width, height);
      } else if (dithering === "atkinson") {
        const f = 1 / 8;
        addError(buf, x + 1, y, er * f, eg * f, eb * f, width, height);
        addError(buf, x + 2, y, er * f, eg * f, eb * f, width, height);
        addError(buf, x - 1, y + 1, er * f, eg * f, eb * f, width, height);
        addError(buf, x, y + 1, er * f, eg * f, eb * f, width, height);
        addError(buf, x + 1, y + 1, er * f, eg * f, eb * f, width, height);
        addError(buf, x, y + 2, er * f, eg * f, eb * f, width, height);
      }
    }
    cells.push(row);
  }

  return cells;
}
