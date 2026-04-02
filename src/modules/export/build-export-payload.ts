import { getBrandDisplayName } from "@/modules/brand-settings/selectors";
import type { ExportPatternPayload, ExportSourceImageMeta } from "@/types/export";
import type { GenerationConfig, MissingColorAnalysis, PatternGenerationResult } from "@/types";
import { getGenerationModeLabel } from "./generation-mode-labels";

export function buildExportPatternPayload(params: {
  generationConfig: GenerationConfig;
  generationResult: PatternGenerationResult;
  missingColorAnalysis?: MissingColorAnalysis | null;
  sourceImage?: ExportSourceImageMeta | null;
}): ExportPatternPayload {
  const { generationConfig, generationResult } = params;
  const missingColorAnalysis = params.missingColorAnalysis ?? null;
  const sourceImage = params.sourceImage ?? null;
  return {
    generationConfig,
    generationResult,
    missingColorAnalysis,
    sourceImage,
    brandDisplayName: getBrandDisplayName(generationConfig.brand),
    tier: generationConfig.tier,
    generationMode: generationConfig.generationMode,
    generationModeLabel: getGenerationModeLabel(generationConfig.generationMode),
  };
}
