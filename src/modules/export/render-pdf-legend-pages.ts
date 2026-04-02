import type { ColorUsageStat, ExportPatternPayload } from "@/types/export";
import type { BrandId } from "@/types";

const TITLE_FONT =
  '600 18px ui-sans-serif, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const BODY_FONT =
  '13px ui-sans-serif, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const SMALL_FONT =
  '11px ui-sans-serif, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

const PAGE_W = 820;
const PAGE_H = 1650;
const PAD = 36;
const ROW_H = 26;
const TOP_BLOCK = 108;
const BOTTOM_PAD = 28;

function displayBrandCode(brand: BrandId, stat: ColorUsageStat): string {
  return stat.brandCode ?? (brand === "mard" ? stat.masterId : "×");
}

function chunkStats(stats: ColorUsageStat[], rowsPerPage: number): ColorUsageStat[][] {
  if (stats.length === 0) return [[]];
  const chunks: ColorUsageStat[][] = [];
  for (let i = 0; i < stats.length; i += rowsPerPage) {
    chunks.push(stats.slice(i, i + rowsPerPage));
  }
  return chunks;
}

/**
 * 图例统计页（可多页）：色号为主，色块 + 颗数；masterId 小号次要列。
 */
export function buildLegendPdfCanvases(
  payload: ExportPatternPayload,
  stats: ColorUsageStat[],
): HTMLCanvasElement[] {
  const brand = payload.generationConfig.brand;
  const r = payload.generationResult;
  const maxRows = Math.max(
    8,
    Math.floor((PAGE_H - TOP_BLOCK - BOTTOM_PAD) / ROW_H),
  );
  const slices = chunkStats(stats, maxRows);
  const totalPages = slices.length;

  return slices.map((slice, pageIndex) => {
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unsupported");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    let y = PAD;
    ctx.fillStyle = "#0f172a";
    ctx.font = TITLE_FONT;
    ctx.textBaseline = "top";
    const title =
      totalPages > 1
        ? `图例与用量（${pageIndex + 1} / ${totalPages}）`
        : "图例与用量";
    ctx.fillText(title, PAD, y);
    y += 32;

    ctx.font = BODY_FONT;
    ctx.fillStyle = "#334155";
    ctx.fillText(
      `${payload.brandDisplayName} · ${payload.tier} 档 · ${payload.generationModeLabel}`,
      PAD,
      y,
    );
    y += 22;
    ctx.fillText(
      `使用色数：${r.usedColorCount}　已填豆数：${r.filledBeads}　总格数：${r.totalBeads}`,
      PAD,
      y,
    );
    y += 28;

    ctx.font = SMALL_FONT;
    ctx.fillStyle = "#64748b";
    const colCodeX = PAD + 36;
    const colCountX = 480;
    const colMasterX = 600;
    ctx.fillText("色号", colCodeX, y);
    ctx.fillText("颗数", colCountX, y);
    ctx.fillText("master", colMasterX, y);
    y += ROW_H - 4;

    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(PAGE_W - PAD, y);
    ctx.stroke();
    y += 10;

    ctx.font = BODY_FONT;
    for (const stat of slice) {
      const code = displayBrandCode(brand, stat);
      ctx.fillStyle = stat.hex;
      ctx.fillRect(PAD, y + 4, 22, 16);
      ctx.strokeStyle = "#94a3b8";
      ctx.strokeRect(PAD, y + 4, 22, 16);

      ctx.fillStyle = "#0f172a";
      ctx.fillText(code, colCodeX, y + 2);

      ctx.fillStyle = "#334155";
      ctx.fillText(String(stat.count), colCountX, y + 2);

      ctx.font = SMALL_FONT;
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(stat.masterId, colMasterX, y + 4);
      ctx.font = BODY_FONT;

      y += ROW_H;
    }

    if (slice.length === 0) {
      ctx.fillStyle = "#64748b";
      ctx.font = BODY_FONT;
      ctx.fillText("（无数颜色用量记录）", PAD, y + 8);
    }

    return canvas;
  });
}
