import type { GenerationConfig } from "./project";

export type GenerationMode = "strict-preset" | "allow-refill";

/**
 * A single pixel/cell in generated pattern.
 * `masterColorId` is the internal MARD anchor; `null` means an empty cell (eraser).
 */
export type PatternCell = {
  x: number;
  y: number;
  masterColorId: string | null;
};

export type PatternGenerationRequest = {
  image: File;
  imageWidth: number;
  imageHeight: number;
  config: GenerationConfig;
};

/** 高级生成调试摘要（Phase 10A / 10B）。 */
export type PatternGenerationOptimizationMeta = {
  processingMode: string;
  dithering: string;
  minColorUsageMergeThreshold: number;
  cleanIsolatedPixels: boolean;
  usedColorCountAfterQuantize: number;
  usedColorCountAfterMerge: number;
  usedColorCountFinal: number;
  /** 被合并掉的低频 master 色种数 */
  mergedMasterIdsCount: number;

  /** Phase 10B — 以下为生成管线写入；旧存档可能缺失 */
  mergeSimilarColors?: boolean;
  similarColorDistanceThreshold?: number;
  mergeSmallRegions?: boolean;
  smallRegionAreaThreshold?: number;
  simplifyBackground?: boolean;
  maxRefillColors?: number | null;
  usedColorCountBeforeSimilarMerge?: number;
  usedColorCountAfterSimilarMerge?: number;
  /** 参与「并入他色」映射的源主色种数（非最终减少量） */
  similarMergeSourceMasterIdsCount?: number;
  smallRegionsMergedCount?: number;
  simplifyBackgroundRegionsMergedCount?: number;
  /** 相对当前 preset 的套装外主色种数（最终结果） */
  distinctRefillMasterIdsFinal?: number;
  /** 因 maxRefillColors 被回收的套装外主色种数 */
  recycledRefillMasterIdsCount?: number;
};

export type PatternGenerationResult = {
  width: number;
  height: number;
  cells: PatternCell[][];
  usedMasterIds: string[];
  /** 画布总格数（含空白格） */
  totalBeads: number;
  /** 已填色格数（不含空白格） */
  filledBeads: number;
  usedColorCount: number;
  paletteCandidateCount?: number;
  sourceImageWidth?: number;
  sourceImageHeight?: number;
  optimizationMeta?: PatternGenerationOptimizationMeta;
};

/** 单条缺色（相对当前 preset 套装而言）。 */
export type MissingColorItem = {
  masterId: string;
  brandCode: string | null;
  neededCount: number;
  inPreset: boolean;
  canBuyInCurrentBrand: boolean;
  alternativeMappings?: Array<{
    brand: string;
    code: string | null;
  }>;
};

export type MissingColorAnalysis = {
  missingColorCount: number;
  missingBeads: number;
  coveredColorCount: number;
  coveredBeads: number;
  coverageRate: number;
  status: "fully-covered" | "needs-refill";
  missingItems: MissingColorItem[];
};
