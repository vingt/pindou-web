import type { GenerationConfig } from "./project";
import type { MissingColorAnalysis, PatternGenerationResult } from "./pattern";

/**
 * Phase 11 — 固定三方案并排比较（非搜索/评分）；用于 UI 与「一键应用」。
 */
export type ComparisonCandidate = {
  id: string;
  title: string;
  config: GenerationConfig;
  result: PatternGenerationResult;
  missingColorAnalysis: MissingColorAnalysis | null;
  summary: {
    width: number;
    height: number;
    totalBeads: number;
    usedColorCount: number;
    missingColorCount: number;
    coverageRate: number;
  };
};
