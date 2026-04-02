import { mergeBrandSettingsBundles } from "./import-merge";
import { isKnownMasterColorId } from "./master-id-universe";
import {
  BRAND_SETTINGS_SCHEMA_VERSION,
  BrandDefinitionSchema,
  BrandColorDefinitionSchema,
  BrandPresetDefinitionSchema,
  BrandSettingsBundleSchema,
  type BrandDefinition,
  type BrandColorDefinition,
  type BrandPresetDefinition,
  type BrandSettingsBundle,
} from "./schema";
import { z } from "zod";

const LooseRootSchema = z
  .object({
    schemaVersion: z.number().int().optional(),
    brands: z.array(z.unknown()).default([]),
    colors: z.array(z.unknown()).default([]),
    presets: z.array(z.unknown()).default([]),
  })
  .passthrough();

export type SettingsImportReport = {
  success: boolean;
  brandsAdded: number;
  brandsOverwritten: number;
  colorsAdded: number;
  colorsSkipped: number;
  presetsAdded: number;
  presetsSkipped: number;
  warnings: string[];
  errors: string[];
};

function colorKey(c: { brandId: string; masterId: string }) {
  return `${c.brandId}\0${c.masterId}`;
}

function normalizeColorRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  const next = { ...o };
  if (next.brandCode === "") next.brandCode = null;
  if (next.isBuiltIn === undefined) next.isBuiltIn = true;
  return next;
}

function normalizePresetRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  const next = { ...o };
  if (Array.isArray(next.masterIds)) {
    next.masterIds = [...new Set(next.masterIds as string[])];
  }
  return next;
}

export function importBrandSettingsFromJsonWithReport(
  text: string,
  mode: "replace" | "merge",
  base: BrandSettingsBundle,
): { ok: true; bundle: BrandSettingsBundle; report: SettingsImportReport } | { ok: false; error: string; report: SettingsImportReport } {
  const report: SettingsImportReport = {
    success: false,
    brandsAdded: 0,
    brandsOverwritten: 0,
    colorsAdded: 0,
    colorsSkipped: 0,
    presetsAdded: 0,
    presetsSkipped: 0,
    warnings: [],
    errors: [],
  };

  const baseBrandIds = new Set(base.brands.map((b) => b.id));
  const baseColorKeys = new Set(base.colors.map(colorKey));
  const basePresetIds = new Set(base.presets.map((p) => p.id));

  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    report.errors.push("JSON 解析失败");
    return { ok: false, error: "JSON 解析失败：内容不是合法的 JSON。", report };
  }

  const loose = LooseRootSchema.safeParse(data);
  if (!loose.success) {
    report.errors.push("根对象需为 JSON 对象且可含 brands/colors/presets 数组");
    return { ok: false, error: `结构校验失败：${loose.error.message}`, report };
  }

  const { brands: rawBrands, colors: rawColors, presets: rawPresets } = loose.data;

  const validBrands: BrandDefinition[] = [];
  const seenIncomingBrandIds = new Set<string>();
  for (let i = 0; i < rawBrands.length; i += 1) {
    const r = BrandDefinitionSchema.safeParse(rawBrands[i]);
    if (!r.success) {
      report.errors.push(`品牌[${i}]: ${r.error.issues.map((x) => x.message).join("；")}`);
      continue;
    }
    if (seenIncomingBrandIds.has(r.data.id)) {
      report.errors.push(`品牌[${i}]: 导入块内 id「${r.data.id}」重复`);
      continue;
    }
    seenIncomingBrandIds.add(r.data.id);
    validBrands.push(r.data);
  }

  if (validBrands.length === 0) {
    report.errors.push("没有有效的品牌条目");
    return { ok: false, error: "导入失败：未解析到任何有效品牌。", report };
  }

  for (const b of validBrands) {
    if (baseBrandIds.has(b.id)) {
      report.brandsOverwritten += 1;
    } else {
      report.brandsAdded += 1;
    }
  }

  const allowedBrandIds =
    mode === "replace"
      ? new Set(validBrands.map((b) => b.id))
      : new Set([...baseBrandIds, ...validBrands.map((b) => b.id)]);

  const acceptedColors: BrandColorDefinition[] = [];
  const seenColorKeys = new Set<string>();
  const seenBrandCodes = new Map<string, Set<string>>();

  for (let i = 0; i < rawColors.length; i += 1) {
    const r = BrandColorDefinitionSchema.safeParse(normalizeColorRaw(rawColors[i]));
    if (!r.success) {
      report.colorsSkipped += 1;
      report.errors.push(`颜色[${i}]: ${r.error.issues.map((x) => x.message).join("；")}`);
      continue;
    }
    const c = r.data;
    if (!allowedBrandIds.has(c.brandId)) {
      report.colorsSkipped += 1;
      report.errors.push(`颜色[${i}]: brandId「${c.brandId}」不在允许的品牌集合中`);
      continue;
    }
    if (!isKnownMasterColorId(c.masterId)) {
      report.colorsSkipped += 1;
      report.errors.push(`颜色[${i}]: 未知 masterId「${c.masterId}」`);
      continue;
    }
    const ck = colorKey(c);
    if (seenColorKeys.has(ck)) {
      report.colorsSkipped += 1;
      report.errors.push(`颜色[${i}]: 与已接受行重复的 brandId+masterId（${c.brandId}/${c.masterId}）`);
      continue;
    }
    if (c.brandCode !== null && c.brandCode !== "") {
      let bs = seenBrandCodes.get(c.brandId);
      if (!bs) {
        bs = new Set();
        seenBrandCodes.set(c.brandId, bs);
      }
      if (bs.has(c.brandCode)) {
        report.colorsSkipped += 1;
        report.errors.push(`颜色[${i}]: 品牌 ${c.brandId} 下色号「${c.brandCode}」重复`);
        continue;
      }
      bs.add(c.brandCode);
    }
    seenColorKeys.add(ck);
    acceptedColors.push(c);
  }

  report.colorsAdded = acceptedColors.filter((c) => !baseColorKeys.has(colorKey(c))).length;

  if (mode === "replace") {
    const keptKeys = new Set(acceptedColors.map(colorKey));
    for (const key of baseColorKeys) {
      if (!keptKeys.has(key)) {
        report.warnings.push(`整包替换将移除原颜色行：${key.replace("\0", " · ")}`);
      }
    }
  }

  const acceptedPresets: BrandPresetDefinition[] = [];
  for (let i = 0; i < rawPresets.length; i += 1) {
    const r = BrandPresetDefinitionSchema.safeParse(normalizePresetRaw(rawPresets[i]));
    if (!r.success) {
      report.presetsSkipped += 1;
      report.errors.push(`套装[${i}]: ${r.error.issues.map((x) => x.message).join("；")}`);
      continue;
    }
    const p = r.data;
    if (!allowedBrandIds.has(p.brandId)) {
      report.presetsSkipped += 1;
      report.errors.push(`套装[${i}]: brandId「${p.brandId}」不在允许的品牌集合中`);
      continue;
    }
    let unknownMid: string | undefined;
    for (const mid of p.masterIds) {
      if (!isKnownMasterColorId(mid)) {
        unknownMid = mid;
        break;
      }
    }
    if (unknownMid !== undefined) {
      report.presetsSkipped += 1;
      report.errors.push(`套装[${i}]: 未知 masterId「${unknownMid}」`);
      continue;
    }
    const acceptedKeysForBrand = new Set(
      acceptedColors.filter((c) => c.brandId === p.brandId).map(colorKey),
    );
    for (const mid of p.masterIds) {
      const ck = `${p.brandId}\0${mid}`;
      if (!acceptedKeysForBrand.has(ck)) {
        report.warnings.push(
          `套装「${p.displayName}」(${p.id})：本批导入颜色中暂无品牌 ${p.brandId} 的主色 ${mid}`,
        );
      } else {
        const row = acceptedColors.find((c) => c.brandId === p.brandId && c.masterId === mid);
        if (row?.brandCode === null) {
          report.warnings.push(
            `套装「${p.displayName}」(${p.id})：品牌 ${p.brandId} 主色 ${mid} 色号未设置（显示为「未设置色号」）`,
          );
        }
      }
    }
    acceptedPresets.push(p);
  }

  report.presetsAdded = acceptedPresets.filter((p) => !basePresetIds.has(p.id)).length;

  if (mode === "replace") {
    const keptPresetIds = new Set(acceptedPresets.map((p) => p.id));
    for (const id of basePresetIds) {
      if (!keptPresetIds.has(id)) {
        report.warnings.push(`整包替换将移除原套装：${id}`);
      }
    }
  }

  let candidate: BrandSettingsBundle;
  if (mode === "replace") {
    candidate = {
      schemaVersion: BRAND_SETTINGS_SCHEMA_VERSION,
      brands: [...validBrands].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
      colors: acceptedColors,
      presets: acceptedPresets,
    };
  } else {
    candidate = mergeBrandSettingsBundles(base, {
      schemaVersion: BRAND_SETTINGS_SCHEMA_VERSION,
      brands: validBrands,
      colors: acceptedColors,
      presets: acceptedPresets,
    });
  }

  const finalParsed = BrandSettingsBundleSchema.safeParse(candidate);
  if (!finalParsed.success) {
    for (const issue of finalParsed.error.issues) {
      report.errors.push(`合并后校验: ${issue.path.join(".")}: ${issue.message}`);
    }
    return {
      ok: false,
      error: "合并后的数据未通过全量校验，已放弃写入。请查看报告中的错误列表。",
      report,
    };
  }

  report.success = true;
  return { ok: true, bundle: finalParsed.data, report };
}
