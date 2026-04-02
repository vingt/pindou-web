import type { MasterCandidate } from "@/modules/pattern/services/dither-quantize";
import { findNearestMasterColor } from "@/modules/pattern/services/dither-quantize";
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

/**
 * 将使用颗数 &lt; threshold 的 master 色合并到当前「高频」集合中 RGB 最近的颜色。
 * threshold ≤ 0 时不修改。
 */
export function mergeLowUsageMasterColors(params: {
  cells: PatternCell[][];
  candidates: MasterCandidate[];
  threshold: number;
}): { cells: PatternCell[][]; mergedMasterIdsCount: number } {
  const { cells, candidates, threshold } = params;
  if (threshold <= 0) {
    return { cells: cloneCells(cells), mergedMasterIdsCount: 0 };
  }

  let working = cloneCells(cells);
  const counts = countByMasterId(working);
  const byId = candidateById(candidates);

  let frequentIds = [...counts.entries()]
    .filter(([, n]) => n >= threshold)
    .map(([id]) => id);

  if (frequentIds.length === 0) {
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!top) return { cells: working, mergedMasterIdsCount: 0 };
    frequentIds = [top];
  }

  const frequentSet = new Set(frequentIds);
  const lowIds = [...counts.entries()]
    .filter(([id, n]) => n > 0 && n < threshold && !frequentSet.has(id))
    .map(([id]) => id);

  if (lowIds.length === 0) {
    return { cells: working, mergedMasterIdsCount: 0 };
  }

  const anchorCandidates = frequentIds
    .map((id) => byId.get(id))
    .filter((c): c is MasterCandidate => Boolean(c));

  if (anchorCandidates.length === 0) {
    return { cells: working, mergedMasterIdsCount: 0 };
  }

  const replacement = new Map<string, string>();
  for (const lowId of lowIds) {
    const lowCand = byId.get(lowId);
    if (!lowCand) continue;
    const nearest = findNearestMasterColor(
      { r: lowCand.r, g: lowCand.g, b: lowCand.b },
      anchorCandidates,
    );
    replacement.set(lowId, nearest.id);
  }

  if (replacement.size === 0) {
    return { cells: working, mergedMasterIdsCount: 0 };
  }

  working = working.map((row) =>
    row.map((c) => {
      if (c.masterColorId === null) return c;
      const to = replacement.get(c.masterColorId);
      if (!to) return c;
      return { ...c, masterColorId: to };
    }),
  );

  return {
    cells: working,
    mergedMasterIdsCount: replacement.size,
  };
}
