import { findNearestMasterColor } from "@/modules/pattern/services/dither-quantize";
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

/**
 * allow-refill：限制套装外主色种数，超出部分按用量从低到高回收并映射到最近允许色。
 */
export function limitMaxRefillColors(params: {
  cells: PatternCell[][];
  presetMasterIdSet: Set<string>;
  candidates: MasterCandidate[];
  maxRefillColors: number;
}): {
  cells: PatternCell[][];
  distinctRefillBefore: number;
  distinctRefillAfter: number;
  recycledRefillMasterIds: number;
} {
  const { cells, presetMasterIdSet, candidates, maxRefillColors } = params;

  if (maxRefillColors < 0) {
    return {
      cells: cloneCells(cells),
      distinctRefillBefore: 0,
      distinctRefillAfter: 0,
      recycledRefillMasterIds: 0,
    };
  }

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const counts = countByMasterId(cells);

  const refillIds = [...counts.keys()].filter((id) => !presetMasterIdSet.has(id));
  const distinctRefillBefore = refillIds.length;

  if (refillIds.length <= maxRefillColors) {
    return {
      cells: cloneCells(cells),
      distinctRefillBefore,
      distinctRefillAfter: refillIds.length,
      recycledRefillMasterIds: 0,
    };
  }

  refillIds.sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b),
  );

  const keptRefill = new Set(refillIds.slice(0, maxRefillColors));
  const dropped = refillIds.slice(maxRefillColors);

  const allowedIds = new Set<string>();
  for (const id of presetMasterIdSet) allowedIds.add(id);
  for (const id of keptRefill) allowedIds.add(id);

  const targetCandidates = candidates.filter((c) => allowedIds.has(c.id));
  if (targetCandidates.length === 0) {
    return {
      cells: cloneCells(cells),
      distinctRefillBefore,
      distinctRefillAfter: distinctRefillBefore,
      recycledRefillMasterIds: 0,
    };
  }

  const replacement = new Map<string, string>();
  for (const dropId of dropped) {
    const cand = byId.get(dropId);
    if (!cand) continue;
    const nearest = findNearestMasterColor(
      { r: cand.r, g: cand.g, b: cand.b },
      targetCandidates,
    );
    replacement.set(dropId, nearest.id);
  }

  if (replacement.size === 0) {
    return {
      cells: cloneCells(cells),
      distinctRefillBefore,
      distinctRefillAfter: distinctRefillBefore,
      recycledRefillMasterIds: 0,
    };
  }

  const working = cloneCells(cells).map((row) =>
    row.map((c) => {
      if (c.masterColorId === null) return c;
      const to = replacement.get(c.masterColorId);
      if (!to) return c;
      return { ...c, masterColorId: to };
    }),
  );

  const afterCounts = countByMasterId(working);
  const distinctRefillAfter = [...afterCounts.keys()].filter(
    (id) => !presetMasterIdSet.has(id),
  ).length;

  return {
    cells: working,
    distinctRefillBefore,
    distinctRefillAfter,
    recycledRefillMasterIds: replacement.size,
  };
}
