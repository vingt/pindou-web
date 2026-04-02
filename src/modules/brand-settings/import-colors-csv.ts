import { normalizeHex6, parseHexToRgb } from "./resolve-nearest-master";

export const BRAND_COLOR_CSV_HEADERS = ["品牌色号", "HEX", "R", "G", "B"] as const;

export type ColorCsvParsedRow =
  | {
      ok: true;
      line: number;
      brandCode: string;
      hex: string;
      r: number;
      g: number;
      b: number;
    }
  | { ok: false; line: number; reason: string };

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  while (i < line.length) {
    const ch = line[i]!;
    if (ch === '"') {
      i += 1;
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        cur += line[i]!;
        i += 1;
      }
      continue;
    }
    if (ch === ",") {
      out.push(cur.trim());
      cur = "";
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  out.push(cur.trim());
  return out;
}

function parseIntChannel(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const v = Number.parseInt(t, 10);
  if (Number.isNaN(v) || v < 0 || v > 255) return null;
  return v;
}

export function parseBrandColorsCsv(text: string): {
  rows: ColorCsvParsedRow[];
  headerError: string | null;
} {
  const raw = text.replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((ln) => ln.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], headerError: "CSV 为空" };
  }
  const headerCells = splitCsvLine(lines[0]!);
  const expected = [...BRAND_COLOR_CSV_HEADERS];
  if (
    headerCells.length < expected.length ||
    !expected.every((h, idx) => headerCells[idx]?.trim() === h)
  ) {
    return {
      rows: [],
      headerError: `表头须为：${expected.join(",")}`,
    };
  }

  const rows: ColorCsvParsedRow[] = [];
  for (let li = 1; li < lines.length; li += 1) {
    const line = lines[li]!;
    const lineNo = li + 1;
    const cells = splitCsvLine(line);
    const brandCode = (cells[0] ?? "").trim();
    const hexRaw = (cells[1] ?? "").trim();
    const rRaw = cells[2] ?? "";
    const gRaw = cells[3] ?? "";
    const bRaw = cells[4] ?? "";

    if (!brandCode) {
      rows.push({ ok: false, line: lineNo, reason: "品牌色号不能为空" });
      continue;
    }
    const hexNorm = normalizeHex6(hexRaw.startsWith("#") ? hexRaw : `#${hexRaw}`);
    if (!hexNorm) {
      rows.push({ ok: false, line: lineNo, reason: "HEX 不合法" });
      continue;
    }
    const r = parseIntChannel(rRaw);
    const g = parseIntChannel(gRaw);
    const b = parseIntChannel(bRaw);
    if (r === null || g === null || b === null) {
      rows.push({ ok: false, line: lineNo, reason: "R/G/B 须为 0–255 的整数" });
      continue;
    }
    const fromHex = parseHexToRgb(hexNorm);
    if (!fromHex || fromHex.r !== r || fromHex.g !== g || fromHex.b !== b) {
      rows.push({ ok: false, line: lineNo, reason: "HEX 与 R/G/B 不一致" });
      continue;
    }
    rows.push({
      ok: true,
      line: lineNo,
      brandCode,
      hex: hexNorm,
      r,
      g,
      b,
    });
  }
  return { rows, headerError: null };
}
