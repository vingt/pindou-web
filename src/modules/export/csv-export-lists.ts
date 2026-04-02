import { getBrandCode, getMasterColorById } from "@/modules/palette/services";
import { encodePaletteCsvRows } from "@/modules/palette/services/palette-csv";
import type { BrandId } from "@/types";
import type { ColorUsageStat } from "@/types/export";
import type { MissingColorAnalysis, MissingColorItem } from "@/types/pattern";

function bom(text: string) {
  return `\uFEFF${text}`;
}

function altLine(item: MissingColorItem): string {
  const alts = item.alternativeMappings;
  if (!alts?.length) return "";
  return alts
    .map((a) => `${a.brand}:${a.code ?? "×"}`)
    .join(" | ");
}

/** 缺色清单：主色编号、当前品牌色号、HEX、需求颗数、其它品牌参考 */
export function buildMissingColorsCsv(
  brand: BrandId,
  analysis: MissingColorAnalysis,
): string {
  const header =
    "主色编号,当前品牌色号,HEX,需求颗数,其它品牌参考（MARD 优先列出）";
  const lines = [header];
  for (const item of analysis.missingItems) {
    const hex = getMasterColorById(item.masterId)?.hex ?? "";
    const row = [
      item.masterId,
      item.brandCode ?? "×",
      hex,
      String(item.neededCount),
      altLine(item).replace(/,/g, "；"),
    ].map((c) => (/,|\r|\n|"/.test(c) ? `"${c.replace(/"/g, '""')}"` : c));
    lines.push(row.join(","));
  }
  return bom(lines.join("\r\n"));
}

/** 色号统计：与色板 CSV 相同前五列，另加数量、占比（相对已填豆）。 */
export function buildColorUsageStatsCsv(
  brand: BrandId,
  stats: ColorUsageStat[],
  filledBeads: number,
): string {
  const denom = Math.max(1, filledBeads);
  const header = "色号,HEX,R,G,B,数量,占比（%）";
  const lines = [header];
  for (const s of stats) {
    const m = getMasterColorById(s.masterId);
    const code = brand === "mard" ? s.masterId : (getBrandCode(brand, s.masterId) ?? "×");
    const hex = m?.hex ?? s.hex;
    const r = m?.r ?? "";
    const g = m?.g ?? "";
    const b = m?.b ?? "";
    const pct = ((s.count / denom) * 100).toFixed(1);
    lines.push([code, hex, String(r), String(g), String(b), String(s.count), pct].join(","));
  }
  return bom(lines.join("\r\n"));
}

/** 当前自定义色板导出（色号为主色编号 + 完整色值）。 */
export function buildCustomPaletteExportCsv(masterIds: string[]): string {
  const rows = masterIds.map((id) => {
    const m = getMasterColorById(id);
    return {
      code: id,
      hex: m?.hex ?? "#ffffff",
      r: m?.r ?? 255,
      g: m?.g ?? 255,
      b: m?.b ?? 255,
    };
  });
  return bom(encodePaletteCsvRows(rows));
}
