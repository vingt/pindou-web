import { PageSizes, type PDFDocument } from "pdf-lib";

/** 将 PNG 字节铺满 A4 内边距区域（保持比例居中）。pdf-lib 坐标系：左下为原点。 */
export async function embedPngPageCentered(
  pdfDoc: PDFDocument,
  pngBytes: Uint8Array,
  marginPt = 36,
): Promise<void> {
  const image = await pdfDoc.embedPng(pngBytes);
  const page = pdfDoc.addPage(PageSizes.A4);
  const pw = page.getWidth();
  const ph = page.getHeight();
  const maxW = pw - 2 * marginPt;
  const maxH = ph - 2 * marginPt;
  const iw = image.width;
  const ih = image.height;
  const scale = Math.min(maxW / iw, maxH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const x = marginPt + (maxW - dw) / 2;
  const y = marginPt + (maxH - dh) / 2;
  page.drawImage(image, { x, y, width: dw, height: dh });
}
