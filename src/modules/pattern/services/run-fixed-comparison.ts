import { analyzeMissingColors } from "@/modules/pattern/services/analyze-missing-colors";
import {
  FIXED_COMPARISON_SCHEMES,
  optimizationForComparisonScheme,
} from "@/modules/pattern/services/fixed-comparison-schemes";
import { generatePattern } from "@/modules/pattern/services/generate-pattern";
import { normalizeGenerationConfig } from "@/types/project";
import type {
  BrandId,
  BrandPresetId,
  ComparisonCandidate,
  GenerationMode,
  PresetTier,
} from "@/types";

export type RunFixedComparisonInput = {
  image: File;
  imageWidth: number;
  imageHeight: number;
  brand: BrandId;
  tier: PresetTier;
  presetId: BrandPresetId;
  generationMode: GenerationMode;
  compareOriginal: boolean;
  targetGridWidth: number;
  targetGridHeight: number;
  customPaletteMasterIds?: string[];
};

/**
 * 基于同一张图与当前品牌 / tier / generationMode，依次跑三条固定 optimization 管线。
 */
export async function runFixedComparisonCandidates(
  input: RunFixedComparisonInput,
): Promise<ComparisonCandidate[]> {
  const out: ComparisonCandidate[] = [];

  for (const spec of FIXED_COMPARISON_SCHEMES) {
    const optimization = optimizationForComparisonScheme(spec);
    const config = normalizeGenerationConfig({
      brand: input.brand,
      tier: input.tier,
      presetId: input.presetId,
      generationMode: input.generationMode,
      compareOriginal: input.compareOriginal,
      targetGridWidth: input.targetGridWidth,
      targetGridHeight: input.targetGridHeight,
      optimization,
      customPaletteMasterIds: input.customPaletteMasterIds,
    });
    const result = await generatePattern({
      image: input.image,
      imageWidth: input.imageWidth,
      imageHeight: input.imageHeight,
      config,
    });
    const missingColorAnalysis = analyzeMissingColors({
      generationResult: result,
      brand: input.brand,
      tier: input.tier,
      presetId: input.presetId,
      generationMode: input.generationMode,
      customPaletteMasterIds: input.customPaletteMasterIds,
    });
    out.push({
      id: spec.id,
      title: spec.title,
      config,
      result,
      missingColorAnalysis,
      summary: {
        width: result.width,
        height: result.height,
        totalBeads: result.totalBeads,
        usedColorCount: result.usedColorCount,
        missingColorCount: missingColorAnalysis.missingColorCount,
        coverageRate: missingColorAnalysis.coverageRate,
      },
    });
  }

  return out;
}
