import {
  DEFAULT_OPTIMIZATION_CONFIG,
  type OptimizationConfig,
  type ProcessingMode,
} from "@/types";

/**
 * 处理模式 → 推荐参数（用户仍可随后单独改抖动/阈值/孤立点）。
 * poster：采用 atkinson + 合并 + 清理（稳定优先）。
 */
export function optimizationPresetForProcessingMode(
  mode: ProcessingMode,
): OptimizationConfig {
  switch (mode) {
    case "standard":
      return {
        ...DEFAULT_OPTIMIZATION_CONFIG,
        processingMode: "standard",
        dithering: "none",
        minColorUsageMergeThreshold: 0,
        cleanIsolatedPixels: false,
      };
    case "detail":
      return {
        ...DEFAULT_OPTIMIZATION_CONFIG,
        processingMode: "detail",
        dithering: "floyd-steinberg",
        minColorUsageMergeThreshold: 0,
        cleanIsolatedPixels: false,
      };
    case "easy":
      return {
        ...DEFAULT_OPTIMIZATION_CONFIG,
        processingMode: "easy",
        dithering: "none",
        minColorUsageMergeThreshold: 3,
        cleanIsolatedPixels: true,
      };
    case "poster":
      return {
        ...DEFAULT_OPTIMIZATION_CONFIG,
        processingMode: "poster",
        dithering: "atkinson",
        minColorUsageMergeThreshold: 5,
        cleanIsolatedPixels: true,
      };
    default:
      return { ...DEFAULT_OPTIMIZATION_CONFIG };
  }
}
