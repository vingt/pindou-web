import { getMasterColorById } from "./palette-service";

/** 与参考文件一致：色号=MARD 主色编号，HEX/RGB 可选。 */
export const PALETTE_CSV_HEADER = "色号,HEX,R,G,B" as const;

/** 下载用：说明行以 # 开头，导入时会跳过。 */
export const PALETTE_CSV_IMPORT_TEMPLATE = `\uFEFF# 拼豆自定义色板 — CSV 导入模板
# 【必填】色号：MARD 221 主色编号（与内部主色一致，如 A1、M52、H11）。
# 【可选】HEX、R、G、B：可留空；填写时请与色库一致，否则导入仍以主色编号为准从系统补全。
# 以 # 开头的行在导入时会被忽略；可删除说明后只保留表头与数据行。

${PALETTE_CSV_HEADER}

`;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]!;
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function escapeCsvField(s: string): string {
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function encodePaletteCsvRows(
  rows: Array<{ code: string; hex: string; r: number; g: number; b: number }>,
): string {
  const lines: string[] = [PALETTE_CSV_HEADER];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvField(row.code),
        escapeCsvField(row.hex),
        String(row.r),
        String(row.g),
        String(row.b),
      ].join(","),
    );
  }
  return lines.join("\r\n");
}

/**
 * 从 CSV 文本解析主色编号列表；色号列可为 MARD 主色 id（大小写不敏感，输出大写规范形）。
 */
export function parsePaletteCsvMasterIds(text: string): { ok: true; ids: string[] } | { ok: false; error: string } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let headerIndex = -1;
  const bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cells = parseCsvLine(trimmed);
    if (cells[0] === "色号") {
      headerIndex = i;
      continue;
    }
    if (headerIndex >= 0) {
      bodyLines.push(trimmed);
    }
  }

  if (headerIndex < 0) {
    return { ok: false, error: "未找到表头行：第一列须为「色号」" };
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const line of bodyLines) {
    const cells = parseCsvLine(line);
    const codeRaw = cells[0]?.trim() ?? "";
    if (!codeRaw) continue;
    const code = codeRaw.toUpperCase();
    const master = getMasterColorById(code);
    if (!master) {
      return { ok: false, error: `未知色号：${codeRaw}` };
    }
    if (!seen.has(master.id)) {
      seen.add(master.id);
      ids.push(master.id);
    }
  }

  if (ids.length === 0) {
    return { ok: false, error: "没有有效的数据行（色号列为空或仅含表头）" };
  }

  return { ok: true, ids };
}
