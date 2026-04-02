import type {
  BrandColorDefinition,
  BrandPresetDefinition,
  BrandSettingsBundle,
} from "./schema";
import { BrandSettingsBundleSchema } from "./schema";
import { isKnownMasterColorId } from "./master-id-universe";

export type BundleValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

/** 全量校验：Zod + 主色键是否在映射域内 + 套装与颜色行提示。 */
export function validateBrandSettingsBundle(bundle: BrandSettingsBundle): BundleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsed = BrandSettingsBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    return { ok: false, errors, warnings };
  }

  const data = parsed.data;
  const brandById = new Map(data.brands.map((b) => [b.id, b]));
  const colorIndex = new Map<string, BrandColorDefinition>();
  for (const c of data.colors) {
    colorIndex.set(`${c.brandId}\0${c.masterId}`, c);
    if (!isKnownMasterColorId(c.masterId)) {
      errors.push(`颜色：品牌 ${c.brandId} 的 masterId「${c.masterId}」不在系统主色键集合中`);
    }
  }

  for (const p of data.presets) {
    for (const mid of p.masterIds) {
      if (!isKnownMasterColorId(mid)) {
        errors.push(`套装 ${p.id}：未知 masterId「${mid}」`);
      }
    }
    const brand = brandById.get(p.brandId);
    if (!brand) continue;
    for (const mid of p.masterIds) {
      const row = colorIndex.get(`${p.brandId}\0${mid}`);
      if (!row) {
        warnings.push(
          `套装「${p.displayName}」(${p.id})：品牌 ${p.brandId} 无主色 ${mid} 的颜色行`,
        );
      } else if (row.brandCode === null && !brand.isCanonical) {
        warnings.push(
          `套装「${p.displayName}」(${p.id})：品牌 ${p.brandId} 主色 ${mid} 色号未设置（null）`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function canDeleteColorRow(
  c: BrandColorDefinition,
  bundle: BrandSettingsBundle,
): boolean {
  const brand = bundle.brands.find((b) => b.id === c.brandId);
  if (!brand) return false;
  if (!brand.isBuiltIn) return true;
  return c.isBuiltIn === false;
}

export function canDeletePresetRow(p: BrandPresetDefinition): boolean {
  return !p.isBuiltIn;
}
