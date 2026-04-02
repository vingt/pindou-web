import {
  ditherAndQuantizeToCells,
  type MasterCandidate,
  type Rgb,
} from "@/modules/pattern/services/dither-quantize";
import { cleanIsolatedSinglePixels } from "@/modules/pattern/services/clean-isolated-pixels";
import { limitMaxRefillColors } from "@/modules/pattern/services/limit-refill-colors";
import { mergeLowUsageMasterColors } from "@/modules/pattern/services/merge-low-usage-colors";
import { mergeSimilarMasterColors } from "@/modules/pattern/services/merge-similar-colors";
import { mergeSmallRegions } from "@/modules/pattern/services/merge-small-regions";
import { simplifyBackgroundEdgeRegions } from "@/modules/pattern/services/simplify-background";
import {
  getBrandFullPurchasableMasterIds,
  getMasterPalette,
  resolvePresetDefinition,
} from "@/modules/palette/services";
import { normalizeGenerationConfig } from "@/types/project";
import type {
  PatternCell,
  PatternGenerationRequest,
  PatternGenerationResult,
} from "@/types";

type DecodedImage = { bitmap: ImageBitmap; width: number; height: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function decodeImage(file: File): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file);
  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
  };
}

function rasterizeImageToGrid(
  bitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
): Rgb[][] {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建画布上下文");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
  const rows: Rgb[][] = [];
  for (let y = 0; y < targetHeight; y += 1) {
    const row: Rgb[] = [];
    for (let x = 0; x < targetWidth; x += 1) {
      const idx = (y * targetWidth + x) * 4;
      row.push({
        r: imageData[idx],
        g: imageData[idx + 1],
        b: imageData[idx + 2],
      });
    }
    rows.push(row);
  }
  return rows;
}

function buildPaletteCandidates(request: PatternGenerationRequest): MasterCandidate[] {
  const masterPalette = getMasterPalette();
  const masterById = new Map(masterPalette.map((item) => [item.id, item]));

  let candidateIds: string[] = [];
  if (request.config.generationMode === "strict-preset") {
    const preset = resolvePresetDefinition(
      request.config.brand,
      request.config.tier,
      request.config.customPaletteMasterIds ?? [],
    );
    candidateIds = preset?.availableMasterIds ?? [];
  } else {
    candidateIds = getBrandFullPurchasableMasterIds(request.config.brand);
  }

  if (candidateIds.length === 0) {
    if (
      request.config.generationMode === "strict-preset" &&
      request.config.tier === "custom"
    ) {
      return [];
    }
    candidateIds = [masterPalette[0]?.id ?? "A1"];
  }

  const uniqueCandidateIds = [...new Set(candidateIds)];
  return uniqueCandidateIds
    .map((id) => masterById.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      id: item.id,
      r: item.r,
      g: item.g,
      b: item.b,
    }));
}

function countDistinctMasterIds(cells: PatternCell[][]): number {
  const s = new Set<string>();
  for (const row of cells) {
    for (const c of row) {
      if (c.masterColorId !== null) s.add(c.masterColorId);
    }
  }
  return s.size;
}

function countDistinctRefillMasterIds(
  cells: PatternCell[][],
  presetSet: Set<string>,
): number {
  const s = new Set<string>();
  for (const row of cells) {
    for (const c of row) {
      const id = c.masterColorId;
      if (id !== null && !presetSet.has(id)) s.add(id);
    }
  }
  return s.size;
}

function buildGenerationResultBase(params: {
  width: number;
  height: number;
  cells: PatternCell[][];
  paletteCandidateCount: number;
  sourceImageWidth: number;
  sourceImageHeight: number;
  optimizationMeta: PatternGenerationResult["optimizationMeta"];
}): PatternGenerationResult {
  const { width, height, cells } = params;
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
  const totalBeads = width * height;
  return {
    width,
    height,
    cells,
    usedMasterIds,
    totalBeads,
    filledBeads,
    usedColorCount: usedMasterIds.length,
    paletteCandidateCount: params.paletteCandidateCount,
    sourceImageWidth: params.sourceImageWidth,
    sourceImageHeight: params.sourceImageHeight,
    optimizationMeta: params.optimizationMeta,
  };
}

export async function generatePattern(
  request: PatternGenerationRequest,
): Promise<PatternGenerationResult> {
  const config = normalizeGenerationConfig(request.config);
  const decoded = await decodeImage(request.image);
  const targetWidth = clamp(config.targetGridWidth, 8, 500);
  const targetHeight = clamp(config.targetGridHeight, 8, 500);
  const rgbRows = rasterizeImageToGrid(decoded.bitmap, targetWidth, targetHeight);
  const candidates = buildPaletteCandidates({ ...request, config });
  decoded.bitmap.close();

  if (candidates.length === 0) {
    throw new Error(
      config.tier === "custom"
        ? "自定义色板为空：请打开「自定义色板」选择颜色或导入 CSV 后再生成"
        : "当前参数下没有可用的量化颜色",
    );
  }

  const opt = config.optimization;

  let cells = ditherAndQuantizeToCells(rgbRows, candidates, opt.dithering);
  const usedAfterQuantize = countDistinctMasterIds(cells);

  const merged = mergeLowUsageMasterColors({
    cells,
    candidates,
    threshold: opt.minColorUsageMergeThreshold,
  });
  cells = merged.cells;
  const usedAfterMerge = countDistinctMasterIds(cells);

  if (opt.cleanIsolatedPixels) {
    cells = cleanIsolatedSinglePixels(cells);
  }

  const usedAfterIsolated = countDistinctMasterIds(cells);
  const usedColorCountBeforeSimilarMerge = usedAfterIsolated;

  let similarMergeSourceMasterIdsCount = 0;
  if (opt.mergeSimilarColors && opt.similarColorDistanceThreshold > 0) {
    const sim = mergeSimilarMasterColors({
      cells,
      candidates,
      distanceThreshold: opt.similarColorDistanceThreshold,
    });
    cells = sim.cells;
    similarMergeSourceMasterIdsCount = sim.sourceMasterIdsRedirected;
  }
  const usedColorCountAfterSimilarMerge = countDistinctMasterIds(cells);

  let smallRegionsMergedCount = 0;
  if (opt.mergeSmallRegions && opt.smallRegionAreaThreshold >= 1) {
    const sm = mergeSmallRegions({
      cells,
      areaThreshold: opt.smallRegionAreaThreshold,
    });
    cells = sm.cells;
    smallRegionsMergedCount = sm.regionsMergedCount;
  }

  let simplifyBackgroundRegionsMergedCount = 0;
  if (opt.simplifyBackground) {
    const bg = simplifyBackgroundEdgeRegions({
      cells,
      smallRegionAreaThreshold: Math.max(1, opt.smallRegionAreaThreshold),
    });
    cells = bg.cells;
    simplifyBackgroundRegionsMergedCount = bg.regionsMergedCount;
  }

  const presetForRefill = resolvePresetDefinition(
    config.brand,
    config.tier,
    config.customPaletteMasterIds ?? [],
  );
  const presetMasterSet = new Set(presetForRefill?.availableMasterIds ?? []);

  let distinctRefillMasterIdsFinal = 0;
  let recycledRefillMasterIdsCount = 0;

  if (config.generationMode === "allow-refill") {
    if (opt.maxRefillColors !== null) {
      const lim = limitMaxRefillColors({
        cells,
        presetMasterIdSet: presetMasterSet,
        candidates,
        maxRefillColors: opt.maxRefillColors,
      });
      cells = lim.cells;
      distinctRefillMasterIdsFinal = lim.distinctRefillAfter;
      recycledRefillMasterIdsCount = lim.recycledRefillMasterIds;
    } else {
      distinctRefillMasterIdsFinal = countDistinctRefillMasterIds(
        cells,
        presetMasterSet,
      );
    }
  } else {
    distinctRefillMasterIdsFinal = 0;
    recycledRefillMasterIdsCount = 0;
  }

  const usedFinal = countDistinctMasterIds(cells);

  const result = buildGenerationResultBase({
    width: targetWidth,
    height: targetHeight,
    cells,
    paletteCandidateCount: candidates.length,
    sourceImageWidth: decoded.width,
    sourceImageHeight: decoded.height,
    optimizationMeta: {
      processingMode: opt.processingMode,
      dithering: opt.dithering,
      minColorUsageMergeThreshold: opt.minColorUsageMergeThreshold,
      cleanIsolatedPixels: opt.cleanIsolatedPixels,
      usedColorCountAfterQuantize: usedAfterQuantize,
      usedColorCountAfterMerge: usedAfterMerge,
      usedColorCountFinal: usedFinal,
      mergedMasterIdsCount: merged.mergedMasterIdsCount,
      mergeSimilarColors: opt.mergeSimilarColors,
      similarColorDistanceThreshold: opt.similarColorDistanceThreshold,
      mergeSmallRegions: opt.mergeSmallRegions,
      smallRegionAreaThreshold: opt.smallRegionAreaThreshold,
      simplifyBackground: opt.simplifyBackground,
      maxRefillColors: opt.maxRefillColors,
      usedColorCountBeforeSimilarMerge,
      usedColorCountAfterSimilarMerge,
      similarMergeSourceMasterIdsCount,
      smallRegionsMergedCount,
      simplifyBackgroundRegionsMergedCount,
      distinctRefillMasterIdsFinal,
      recycledRefillMasterIdsCount,
    },
  });

  return result;
}
