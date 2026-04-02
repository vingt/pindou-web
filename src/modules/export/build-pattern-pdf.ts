import { PDFDocument } from "pdf-lib";
import { buildColorUsageStats } from "./color-usage-stats";
import { embedPngPageCentered } from "./pdf-embed";
import { canvasToPngBytes, renderSinglePagePdfExportCanvas } from "./render-pattern-png";
import { buildLegendPdfCanvases } from "./render-pdf-legend-pages";
import { buildMissingAnalysisPdfCanvases } from "./render-pdf-missing-pages";
import type { ExportPatternPayload } from "@/types/export";

/**
 * 多页施工 PDF：第 1 页图纸（沿用单页布局）→ 图例用量（可分页）→ 缺色分析（可分页）。
 */
export async function exportPatternPdf(
  payload: ExportPatternPayload,
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  await embedPngPageCentered(
    pdfDoc,
    await canvasToPngBytes(renderSinglePagePdfExportCanvas(payload)),
  );

  const stats = buildColorUsageStats(
    payload.generationResult,
    payload.generationConfig.brand,
  );
  for (const canvas of buildLegendPdfCanvases(payload, stats)) {
    await embedPngPageCentered(pdfDoc, await canvasToPngBytes(canvas));
  }

  for (const canvas of buildMissingAnalysisPdfCanvases(payload)) {
    await embedPngPageCentered(pdfDoc, await canvasToPngBytes(canvas));
  }

  const bytes = await pdfDoc.save();
  const copy = Uint8Array.from(bytes);
  return new Blob([copy], { type: "application/pdf" });
}
