import type { MasterCandidate } from "@/modules/pattern/services/dither-quantize";
import type { PatternCell } from "@/types";

function cloneCells(cells: PatternCell[][]): PatternCell[][] {
  return cells.map((row) => row.map((c) => ({ ...c })));
}

function countByMasterId(cells: PatternCell[][]): Map<string, number> {
  const m = new Map<string, number>();
  for (const row of cells) {
    for (const c of row) {
      if (c.masterColorId === null) continue;
      const id = c.masterColorId;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
  }
  return m;
}

function candidateById(
  candidates: MasterCandidate[],
): Map<string, MasterCandidate> {
  return new Map(candidates.map((c) => [c.id, c]));
}

function rgbDistance(a: MasterCandidate, b: MasterCandidate): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * 将 RGB 距离小于阈值的已用色并入使用量更多（同量则 id 更小）的锚色；仅映射向「更优」锚点，避免环。
 */
export function mergeSimilarMasterColors(params: {
  cells: PatternCell[][];
  candidates: MasterCandidate[];
  distanceThreshold: number;
}): { cells: PatternCell[][]; sourceMasterIdsRedirected: number } {
  const { cells, candidates, distanceThreshold } = params;
  if (distanceThreshold <= 0) {
    return { cells: cloneCells(cells), sourceMasterIdsRedirected: 0 };
  }

  let working = cloneCells(cells);
  const counts = countByMasterId(working);
  const byId = candidateById(candidates);

  const usedIds = [...counts.keys()].filter((id) => byId.has(id));
  if (usedIds.length <= 1) {
    return { cells: working, sourceMasterIdsRedirected: 0 };
  }

  const usedIdsByCountAsc = [...usedIds].sort(
    (a, b) =>
      (counts.get(a) ?? 0) - (counts.get(b) ?? 0) || a.localeCompare(b),
  );

  const redirect = new Map<string, string>();

  for (const id of usedIdsByCountAsc) {
    const cnt = counts.get(id) ?? 0;
    const rgb = byId.get(id);
    if (!rgb) continue;

    let bestTarget: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const tid of usedIds) {
      if (tid === id) continue;
      const tcnt = counts.get(tid) ?? 0;
      const tRgb = byId.get(tid);
      if (!tRgb) continue;

      const higherUsage = tcnt > cnt;
      const tieBreakWinner = tcnt === cnt && tid < id;
      if (!higherUsage && !tieBreakWinner) continue;

      const d = rgbDistance(rgb, tRgb);
      if (d > distanceThreshold) continue; // 欧氏距离，≤ 阈值视为相近

      if (d < bestDist) {
        bestDist = d;
        bestTarget = tid;
      } else if (
        d === bestDist &&
        (bestTarget === null || tid.localeCompare(bestTarget) < 0)
      ) {
        bestTarget = tid;
      }
    }

    if (bestTarget !== null) {
      redirect.set(id, bestTarget);
    }
  }

  if (redirect.size === 0) {
    return { cells: working, sourceMasterIdsRedirected: 0 };
  }

  function resolve(id: string): string {
    let x = id;
    for (let i = 0; i < 64; i += 1) {
      const n = redirect.get(x);
      if (n === undefined) return x;
      x = n;
    }
    return x;
  }

  const resolved = new Map<string, string>();
  for (const id of redirect.keys()) {
    resolved.set(id, resolve(id));
  }

  working = working.map((row) =>
    row.map((c) => {
      if (c.masterColorId === null) return c;
      const to = resolved.get(c.masterColorId);
      if (!to) return c;
      return { ...c, masterColorId: to };
    }),
  );

  return {
    cells: working,
    sourceMasterIdsRedirected: redirect.size,
  };
}
