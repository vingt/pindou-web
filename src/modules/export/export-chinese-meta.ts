import type { ExportPatternPayload } from "@/types/export";
import type { DitheringMode, ProcessingMode } from "@/types/optimization";

const PROCESSING_LABEL: Record<ProcessingMode, string> = {
  standard: "标准",
  detail: "细节优先",
  easy: "易做优先",
  poster: "海报 / 插画风",
};

const DITHER_LABEL: Record<DitheringMode, string> = {
  none: "无",
  "floyd-steinberg": "Floyd–Steinberg",
  atkinson: "Atkinson",
  bayer: "Bayer（有序抖动）",
};

/**
 * 导出 PNG / PDF 页眉用的中文参数行（多行，便于排版）。
 */
export function buildExportChineseMetaLines(payload: ExportPatternPayload): string[] {
  const { generationConfig: cfg, brandDisplayName, tier, generationModeLabel } = payload;
  const opt = cfg.optimization;
  const lines: string[] = [
    `${brandDisplayName} · ${tier} 色套装 · ${generationModeLabel}`,
    `底板尺寸：${cfg.targetGridWidth}×${cfg.targetGridHeight} 珠 · 图纸网格：${payload.generationResult.width}×${payload.generationResult.height}`,
    `处理模式：${PROCESSING_LABEL[opt.processingMode] ?? opt.processingMode} · 抖动：${DITHER_LABEL[opt.dithering] ?? opt.dithering}`,
    `最小用量合并：${opt.minColorUsageMergeThreshold} 颗 · 孤立点清理：${opt.cleanIsolatedPixels ? "开" : "关"}`,
    `相近色合并：${opt.mergeSimilarColors ? "开" : "关"}（距离阈值 ${opt.similarColorDistanceThreshold}）`,
    `小区域合并：${opt.mergeSmallRegions ? "开" : "关"}（面积 ≤ ${opt.smallRegionAreaThreshold} 格） · 背景简化：${opt.simplifyBackground ? "开" : "关"}`,
  ];
  if (cfg.generationMode === "allow-refill") {
    lines.push(
      `最大补色数：${opt.maxRefillColors === null ? "不限制" : String(opt.maxRefillColors)}`,
    );
  }
  return lines;
}
