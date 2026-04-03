import { buildExportChineseMetaLines } from "@/modules/export/export-chinese-meta";
import { getBrandCode, getMasterColorById } from "@/modules/palette/services";
import type { BrandId } from "@/types";
import type { ExportPatternPayload } from "@/types/export";

const HEADER_FONT =
  '600 14px ui-sans-serif, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const PDF_TITLE_FONT =
  '600 18px ui-sans-serif, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const PDF_META_FONT =
  '13px ui-sans-serif, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

export type PatternPngOptions = {
  showGridLines: boolean;
  showTitle: boolean;
  /** 单格边长（像素） */
  cellSize: number;
  /** 格内标注当前品牌色号（导出图） */
  showCellLabels: boolean;
};

/** 导出用单格上限与画布预算（提高后可放大查看仍清晰） */
export const EXPORT_PATTERN_MAX_CELL = 56;
const PNG_EXPORT_MAX_GRID_W = 2800;
const PNG_EXPORT_MAX_GRID_H = 3000;

function cellExportDisplayCode(brand: BrandId, masterId: string): string {
  if (brand === "mard") return masterId;
  return getBrandCode(brand, masterId) ?? "×";
}

function textColorForBackground(hex: string): string {
  if (hex.length < 7 || hex[0] !== "#") return "#0f172a";
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

function drawEmptyCell(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cell: number,
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(px, py, cell, cell);
  ctx.strokeStyle = "rgba(203, 213, 225, 0.85)";
  ctx.lineWidth = Math.max(0.5, cell * 0.06);
  ctx.beginPath();
  ctx.moveTo(px, py + cell);
  ctx.lineTo(px + cell, py);
  ctx.stroke();
}

function drawPatternGrid(
  ctx: CanvasRenderingContext2D,
  payload: ExportPatternPayload,
  gx: number,
  gy: number,
  cell: number,
  showGridLines: boolean,
  showCellLabels: boolean,
) {
  const result = payload.generationResult;
  const brand = payload.generationConfig.brand;
  const w = result.width;
  const h = result.height;
  const gridW = cell * w;
  const gridH = cell * h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cellData = result.cells[y][x];
      const px = gx + x * cell;
      const py = gy + y * cell;
      if (cellData.masterColorId === null) {
        drawEmptyCell(ctx, px, py, cell);
      } else {
        const master = getMasterColorById(cellData.masterColorId);
        ctx.fillStyle = master?.hex ?? "#ffffff";
        ctx.fillRect(px, py, cell, cell);
      }
    }
  }

  if (showCellLabels && cell >= 9) {
    const fs = Math.max(5, Math.min(Math.floor(cell * 0.38), 11));
    const font = `600 ${fs}px ui-sans-serif, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cellData = result.cells[y][x];
        const mid = cellData.masterColorId;
        if (mid === null) continue;
        const master = getMasterColorById(mid);
        const hex = master?.hex ?? "#ffffff";
        const label = cellExportDisplayCode(brand, mid);
        const px = gx + x * cell;
        const py = gy + y * cell;
        const cx = px + cell / 2;
        const cy = py + cell / 2;
        const fill = textColorForBackground(hex);
        ctx.strokeStyle = fill === "#ffffff" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.55)";
        ctx.lineWidth = Math.max(0.6, fs * 0.12);
        ctx.strokeText(label, cx, cy);
        ctx.fillStyle = fill;
        ctx.fillText(label, cx, cy);
      }
    }
  }

  if (showGridLines) {
    ctx.strokeStyle = "rgba(15, 23, 42, 0.22)";
    ctx.lineWidth = Math.max(1, cell * 0.04);
    for (let x = 0; x <= w; x++) {
      ctx.beginPath();
      ctx.moveTo(gx + x * cell + 0.5, gy);
      ctx.lineTo(gx + x * cell + 0.5, gy + gridH);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y++) {
      ctx.beginPath();
      ctx.moveTo(gx, gy + y * cell + 0.5);
      ctx.lineTo(gx + gridW, gy + y * cell + 0.5);
      ctx.stroke();
    }
  }
}

const PNG_META_LINE_H = 16;

/**
 * PNG：顶部中文参数多行；其下为带色号标注的网格。
 */
export function renderExportPatternCanvas(
  payload: ExportPatternPayload,
  options: PatternPngOptions,
): HTMLCanvasElement {
  const { generationResult: result } = payload;
  const w = result.width;
  const h = result.height;
  const pad = 12;
  const metaLines = options.showTitle ? buildExportChineseMetaLines(payload) : [];
  const headerBlock =
    options.showTitle && metaLines.length > 0
      ? 12 + metaLines.length * PNG_META_LINE_H + 8
      : options.showTitle
        ? 40
        : pad;
  const cell = options.cellSize;
  const gridW = cell * w;
  const gridH = cell * h;
  const cw = Math.max(pad * 2 + gridW, 320);
  const ch = pad + headerBlock + gridH + pad;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unsupported");

  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, 0, cw, ch);

  const gx = Math.floor((cw - gridW) / 2);
  const gy = pad + headerBlock;

  if (options.showTitle && metaLines.length > 0) {
    ctx.fillStyle = "#0f172a";
    ctx.font = HEADER_FONT;
    ctx.textBaseline = "top";
    let ly = pad + 4;
    for (const line of metaLines) {
      ctx.fillText(line, pad, ly);
      ly += PNG_META_LINE_H;
    }
  }

  drawPatternGrid(
    ctx,
    payload,
    gx,
    gy,
    cell,
    options.showGridLines,
    options.showCellLabels,
  );

  return canvas;
}

export function computePatternCellSizeForBox(
  gridW: number,
  gridH: number,
  maxPixelsW: number,
  maxPixelsH: number,
  minCell = 6,
  maxCell = EXPORT_PATTERN_MAX_CELL,
): number {
  if (gridW <= 0 || gridH <= 0) return minCell;
  const byW = Math.floor(maxPixelsW / gridW);
  const byH = Math.floor(maxPixelsH / gridH);
  const raw = Math.min(byW, byH, maxCell);
  return Math.max(minCell, raw);
}

/**
 * 单页 PDF：标题、品牌/tier/模式、主图、底部简短统计（canvas → PNG → 嵌入 PDF）。
 */
const PDF_META_LINE_H = 17;

export function renderSinglePagePdfExportCanvas(
  payload: ExportPatternPayload,
): HTMLCanvasElement {
  const result = payload.generationResult;
  const w = result.width;
  const h = result.height;
  const pad = 20;
  const metaLines = buildExportChineseMetaLines(payload);
  const titleBlock = 28 + metaLines.length * PDF_META_LINE_H + 18;
  const footerBlock = 58;
  const maxCanvasW = 2600;
  const maxTotalH = 4000;
  const availGridW = maxCanvasW - pad * 2;
  const availGridH = maxTotalH - pad * 2 - titleBlock - footerBlock;
  const cell = computePatternCellSizeForBox(w, h, availGridW, availGridH, 10, EXPORT_PATTERN_MAX_CELL);
  const gridW = cell * w;
  const gridH = cell * h;
  const cw = Math.max(pad * 2 + gridW, 420);
  const ch = pad + titleBlock + gridH + footerBlock + pad;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unsupported");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);

  let y = pad;
  ctx.fillStyle = "#0f172a";
  ctx.font = PDF_TITLE_FONT;
  ctx.textBaseline = "top";
  ctx.fillText("拼豆图纸", pad, y);
  y += 28;
  ctx.font = PDF_META_FONT;
  ctx.fillStyle = "#334155";
  for (const line of metaLines) {
    ctx.fillText(line, pad, y);
    y += PDF_META_LINE_H;
  }
  y += 8;

  const gx = Math.floor((cw - gridW) / 2);
  const gy = y;
  drawPatternGrid(ctx, payload, gx, gy, cell, true, true);

  const footerY = gy + gridH + 16;
  ctx.fillStyle = "#475569";
  ctx.font = PDF_META_FONT;
  ctx.fillText(
    `画布：${w} × ${h} 已填豆数：${result.filledBeads} 使用色数：${result.usedColorCount} 总格数：${result.totalBeads}`,
    pad,
    footerY,
  );

  return canvas;
}

export async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("PNG 编码失败"));
      },
      "image/png",
      1,
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * 导出 PNG Blob（默认 16px 格、网格线、单行标题）。
 */
export async function exportPatternPng(
  payload: ExportPatternPayload,
  options?: Partial<PatternPngOptions>,
): Promise<Blob> {
  const r = payload.generationResult;
  const headerAllowance = 140;
  const padTotal = 48;
  const autoCell = computePatternCellSizeForBox(
    r.width,
    r.height,
    PNG_EXPORT_MAX_GRID_W - padTotal,
    PNG_EXPORT_MAX_GRID_H - headerAllowance,
    12,
    EXPORT_PATTERN_MAX_CELL,
  );
  const opts: PatternPngOptions = {
    showGridLines: true,
    showTitle: true,
    showCellLabels: true,
    ...options,
    cellSize: options?.cellSize ?? autoCell,
  };
  const canvas = renderExportPatternCanvas(payload, opts);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("PNG 编码失败"));
      },
      "image/png",
      1,
    );
  });
}
