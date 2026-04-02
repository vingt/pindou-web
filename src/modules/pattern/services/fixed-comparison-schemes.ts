import { optimizationPresetForProcessingMode } from "@/modules/pattern/services/optimization-presets";
import type { ProcessingMode } from "@/types";

export type FixedComparisonSchemeSpec = {
  id: string;
  title: string;
  processingMode: ProcessingMode;
};

/**
 * Phase 11 固定三候选（与需求一致：标准 / 细节优先 / 易做优先）。
 * 具体 optimization 与 `optimizationPresetForProcessingMode` 对齐。
 */
export const FIXED_COMPARISON_SCHEMES: FixedComparisonSchemeSpec[] = [
  { id: "cmp-standard", title: "标准方案", processingMode: "standard" },
  { id: "cmp-detail", title: "细节优先", processingMode: "detail" },
  { id: "cmp-easy", title: "易做优先", processingMode: "easy" },
];

export function optimizationForComparisonScheme(
  spec: FixedComparisonSchemeSpec,
) {
  return optimizationPresetForProcessingMode(spec.processingMode);
}
