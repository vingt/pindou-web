export type ProcessingMode = "standard" | "detail" | "easy" | "poster";

export type DitheringMode = "none" | "floyd-steinberg" | "atkinson" | "bayer";

export type OptimizationConfig = {
  processingMode: ProcessingMode;
  dithering: DitheringMode;
  /** 使用颗数低于此值的 master 色合并到最近高频色；0 关闭 */
  minColorUsageMergeThreshold: number;
  cleanIsolatedPixels: boolean;

  mergeSimilarColors: boolean;
  /** RGB 欧氏距离，≤ 此值则合并；0 或与开关关闭时无效 */
  similarColorDistanceThreshold: number;
  mergeSmallRegions: boolean;
  /** 面积（格数）≤ N 的连通区域并入邻域主色 */
  smallRegionAreaThreshold: number;
  simplifyBackground: boolean;
  /** 仅 allow-refill；null 不限制套装外颜色种数 */
  maxRefillColors: number | null;
};

export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  processingMode: "standard",
  dithering: "none",
  minColorUsageMergeThreshold: 0,
  cleanIsolatedPixels: false,

  mergeSimilarColors: false,
  similarColorDistanceThreshold: 18,
  mergeSmallRegions: false,
  smallRegionAreaThreshold: 3,
  simplifyBackground: false,
  maxRefillColors: null,
};
