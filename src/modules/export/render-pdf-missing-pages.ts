import type { ExportPatternPayload } from "@/types/export";
import type { BrandId } from "@/types";
import type { MissingColorItem } from "@/types/pattern";
import { formatAlternativesLine } from "./alternatives-line";
import { wrapTextToLines } from "./pdf-text-wrap";

const TITLE_FONT =
  '600 18px ui-sans-serif, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const HEAD_LINE_FONT =
  '600 14px ui-sans-serif, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const BODY_FONT =
  '13px ui-sans-serif, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const SMALL_FONT =
  '12px ui-sans-serif, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

const PAGE_W = 820;
const PAGE_H = 1650;
const PAD = 36;
const MAX_TEXT_W = PAGE_W - PAD * 2;
const PAGE_BOTTOM_MARGIN = 36;
/** 与 needs-refill 页中「汇总行」之后第一条目 y 一致（PAD + 标题区 + 汇总 + 间距） */
const FIRST_ITEM_Y = 146;
const AVAILABLE_BODY_H =
  PAGE_H - PAGE_BOTTOM_MARGIN - FIRST_ITEM_Y;

function primaryMissingCode(brand: BrandId, item: MissingColorItem): string {
  return item.brandCode ?? (brand === "mard" ? item.masterId : "×");
}

function estimateItemBlockHeight(
  ctx: CanvasRenderingContext2D,
  item: MissingColorItem,
  brand: BrandId,
): number {
  const alt = formatAlternativesLine(item.masterId, brand);
  const altLines = wrapTextToLines(ctx, `其它品牌替代：${alt}`, MAX_TEXT_W);
  return 96 + altLines.length * 18;
}

function chunkMissingItems(
  items: MissingColorItem[],
  brand: BrandId,
): MissingColorItem[][] {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return [items];
  ctx.font = BODY_FONT;

  const chunks: MissingColorItem[][] = [];
  let batch: MissingColorItem[] = [];
  let used = 0;

  for (const item of items) {
    const h = estimateItemBlockHeight(ctx, item, brand);
    if (batch.length > 0 && used + h > AVAILABLE_BODY_H) {
      chunks.push(batch);
      batch = [];
      used = 0;
    }
    batch.push(item);
    used += h;
  }
  if (batch.length) chunks.push(batch);
  return chunks.length ? chunks : [[]];
}

function drawMissingPageHeader(
  ctx: CanvasRenderingContext2D,
  payload: ExportPatternPayload,
  pageIndex: number,
  totalPages: number,
): number {
  let y = PAD;
  ctx.fillStyle = "#0f172a";
  ctx.font = TITLE_FONT;
  ctx.textBaseline = "top";
  const title =
    totalPages > 1
      ? `缺色分析（${pageIndex + 1} / ${totalPages}）`
      : "缺色分析";
  ctx.fillText(title, PAD, y);
  y += 34;

  ctx.font = BODY_FONT;
  ctx.fillStyle = "#475569";
  ctx.fillText(
    `${payload.brandDisplayName} · ${payload.tier} 档`,
    PAD,
    y,
  );
  return y + 26;
}

/**
 * 缺色分析 PDF 页（可多页）：主视觉为「缺色色号」；替代链由 formatAlternativesLine（MARD 优先）。
 */
export function buildMissingAnalysisPdfCanvases(
  payload: ExportPatternPayload,
): HTMLCanvasElement[] {
  const brand = payload.generationConfig.brand;
  const analysis = payload.missingColorAnalysis;

  const makeEmptyPage = (lines: string[]): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_W;
    canvas.height = Math.min(520, PAGE_H);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unsupported");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let y = drawMissingPageHeader(ctx, payload, 0, 1);
    ctx.font = BODY_FONT;
    ctx.fillStyle = "#334155";
    for (const line of lines) {
      ctx.fillText(line, PAD, y);
      y += 22;
    }
    return canvas;
  };

  if (!analysis) {
    return [
      makeEmptyPage(["暂无缺色分析数据。", "请重新生成图纸后再导出。"]),
    ];
  }

  if (analysis.status === "fully-covered") {
    return [
      makeEmptyPage([
        "当前套装可直接完成该图纸。",
        `覆盖率：${(analysis.coverageRate * 100).toFixed(1)}%`,
      ]),
    ];
  }

  const items = analysis.missingItems;
  if (items.length === 0) {
    return [
      makeEmptyPage([
        "分析为需补色，但无缺色条目明细。",
        "请重新生成图纸后再试。",
      ]),
    ];
  }

  const slices = chunkMissingItems(items, brand);
  const totalPages = slices.length;

  return slices.map((slice, pageIndex) => {
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unsupported");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    let y = drawMissingPageHeader(ctx, payload, pageIndex, totalPages);

    ctx.font = BODY_FONT;
    ctx.fillStyle = "#64748b";
    ctx.fillText(
      `缺 ${analysis.missingColorCount} 色 · 缺色豆数 ${analysis.missingBeads} · 覆盖率 ${(analysis.coverageRate * 100).toFixed(1)}%`,
      PAD,
      y,
    );
    y += 28;

    for (const item of slice) {
      const code = primaryMissingCode(brand, item);
      ctx.fillStyle = "#0f172a";
      ctx.font = HEAD_LINE_FONT;
      ctx.fillText(`缺色色号：${code}`, PAD, y);
      y += 22;

      ctx.font = SMALL_FONT;
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`（内部 master：${item.masterId}）`, PAD, y);
      y += 18;

      ctx.font = BODY_FONT;
      ctx.fillStyle = "#334155";
      ctx.fillText(`需求数量：${item.neededCount}`, PAD, y);
      y += 20;

      ctx.font = SMALL_FONT;
      ctx.fillStyle = "#475569";
      const alt = formatAlternativesLine(item.masterId, brand);
      const altLines = wrapTextToLines(ctx, `其它品牌替代：${alt}`, MAX_TEXT_W);
      for (const line of altLines) {
        ctx.fillText(line, PAD, y);
        y += 17;
      }
      y += 14;

      ctx.strokeStyle = "#f1f5f9";
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(PAGE_W - PAD, y);
      ctx.stroke();
      y += 12;
    }

    return canvas;
  });
}
