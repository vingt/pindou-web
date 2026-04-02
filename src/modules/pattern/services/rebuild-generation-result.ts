import type { PatternCell, PatternGenerationResult } from "@/types";

function cloneCells(cells: PatternCell[][]): PatternCell[][] {
  return cells.map((row) => row.map((cell) => ({ ...cell })));
}

export function rebuildGenerationResultWithCells(params: {
  base: PatternGenerationResult;
  cells: PatternCell[][];
}): PatternGenerationResult {
  const { base, cells } = params;
  const usedMasterIdSet = new Set<string>();
  let filledBeads = 0;
  for (const row of cells) {
    for (const cell of row) {
      if (cell.masterColorId !== null) {
        filledBeads += 1;
        usedMasterIdSet.add(cell.masterColorId);
      }
    }
  }
  const usedMasterIds = [...usedMasterIdSet];
  return {
    ...base,
    cells: cloneCells(cells),
    usedMasterIds,
    usedColorCount: usedMasterIds.length,
    totalBeads: base.width * base.height,
    filledBeads,
  };
}
