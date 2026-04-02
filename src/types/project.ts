import type { BrandId, BrandPresetId, PresetTier } from "./palette";
import type { GenerationMode, MissingColorAnalysis, PatternGenerationResult } from "./pattern";
import {
  DEFAULT_OPTIMIZATION_CONFIG,
  type OptimizationConfig,
} from "./optimization";

export type { OptimizationConfig, ProcessingMode, DitheringMode } from "./optimization";
export { DEFAULT_OPTIMIZATION_CONFIG } from "./optimization";

export type GenerationConfig = {
  brand: BrandId;
  tier: PresetTier;
  presetId: BrandPresetId;
  generationMode: GenerationMode;
  compareOriginal: boolean;
  /** 生成图纸目标网格宽高（珠数），默认 52×39 */
  targetGridWidth: number;
  targetGridHeight: number;
  optimization: OptimizationConfig;
  /** `tier === "custom"` 时使用的 MARD 主色编号列表 */
  customPaletteMasterIds?: string[];
};

export const DEFAULT_TARGET_GRID_WIDTH = 52;
export const DEFAULT_TARGET_GRID_HEIGHT = 39;

type GenerationConfigInput = Omit<
  GenerationConfig,
  "optimization" | "targetGridWidth" | "targetGridHeight"
> & {
  optimization?: Partial<OptimizationConfig> | undefined;
  targetGridWidth?: number;
  targetGridHeight?: number;
  customPaletteMasterIds?: string[];
};

/** 合并缺省 optimization（旧项目/缺字段时）。 */
export function normalizeGenerationConfig(partial: GenerationConfigInput): GenerationConfig {
  const {
    optimization: optIn,
    targetGridWidth: tw,
    targetGridHeight: th,
    customPaletteMasterIds: custIn,
    ...core
  } = partial;
  const base: GenerationConfig = {
    ...core,
    targetGridWidth: tw ?? DEFAULT_TARGET_GRID_WIDTH,
    targetGridHeight: th ?? DEFAULT_TARGET_GRID_HEIGHT,
    optimization: { ...DEFAULT_OPTIMIZATION_CONFIG, ...optIn },
  };
  if (base.tier === "custom") {
    base.customPaletteMasterIds = [...new Set(custIn ?? [])];
  }
  return base;
}

/**
 * Serializable source image metadata (bytes optional via data URL).
 * Used in PatternProject import/export and local persistence.
 */
export type ProjectSourceImageMeta = {
  fileName: string | null;
  width: number;
  height: number;
  mimeType?: string | null;
  /** data:... URL so preview + 重新生成 can restore a File */
  imageDataUrl?: string | null;
};

/**
 * Stable on-disk / wire format for a bead pattern project (Phase 8).
 * Version bumps require explicit migration or import guards.
 */
export type PatternProject = {
  version: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceImage: ProjectSourceImageMeta;
  generationConfig: GenerationConfig;
  generationResult: PatternGenerationResult | null;
  missingColorAnalysis: MissingColorAnalysis | null;
};
