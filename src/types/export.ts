import type { PresetTier } from "./palette";
import type { GenerationMode, MissingColorAnalysis, PatternGenerationResult } from "./pattern";
import type { GenerationConfig } from "./project";

/** 导出层使用的源图元信息（不含像素数据）。 */
export type ExportSourceImageMeta = {
  width: number;
  height: number;
  fileName: string | null;
};

/**
 * 导出 PNG / PDF 等消费的一致快照。
 * 品牌、tier、模式在顶层与 generationConfig 一致，便于模板读取。
 * missingColorAnalysis / sourceImage 无数据时为 null（Phase 6A 导出可不传）。
 */
export type ExportPatternPayload = {
  generationConfig: GenerationConfig;
  generationResult: PatternGenerationResult;
  missingColorAnalysis: MissingColorAnalysis | null;
  sourceImage: ExportSourceImageMeta | null;
  brandDisplayName: string;
  tier: PresetTier;
  generationMode: GenerationMode;
  generationModeLabel: string;
};

/** 图例统计：按 master 聚合用量。 */
export type ColorUsageStat = {
  masterId: string;
  count: number;
  brandCode: string | null;
  hex: string;
};
