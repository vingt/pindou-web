import { z } from "zod";

/** Stable wire format for import/export. */
export const BRAND_SETTINGS_SCHEMA_VERSION = 1 as const;

const masterIdRegex = /^[A-Z]\d+$/;
/** 小写字母开头；仅小写字母、数字、下划线、中划线。 */
export const BRAND_ID_SAFE_REGEX = /^[a-z][a-z0-9_-]*$/;

export const PresetTierSettingSchema = z.union([
  z.literal(24),
  z.literal(48),
  z.literal(72),
  z.literal(96),
  z.literal(120),
  z.literal(144),
  z.literal(168),
  z.literal(192),
  z.literal(216),
  z.literal(221),
  z.literal(264),
  z.literal(293),
  z.literal("custom"),
]);

export const BrandDefinitionSchema = z
  .object({
    id: z.string().regex(BRAND_ID_SAFE_REGEX),
    displayName: z.string().min(1),
    description: z.string().optional(),
    isBuiltIn: z.boolean(),
    isEnabled: z.boolean(),
    sortOrder: z.number().int(),
    isCanonical: z.boolean().optional(),
  })
  .strict();

export const BrandColorDefinitionSchema = z
  .object({
    brandId: z.string().regex(BRAND_ID_SAFE_REGEX),
    brandCode: z.union([z.string(), z.null()]),
    hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    r: z.number().int().min(0).max(255),
    g: z.number().int().min(0).max(255),
    b: z.number().int().min(0).max(255),
    masterId: z.string().regex(masterIdRegex),
    isEnabled: z.boolean(),
    /** 内置数据为 true；用户新增为 false。缺省按 true 处理（兼容旧 JSON）。 */
    isBuiltIn: z.boolean().optional(),
  })
  .strict();

export const BrandPresetDefinitionSchema = z
  .object({
    id: z.string().min(1),
    brandId: z.string().regex(BRAND_ID_SAFE_REGEX),
    displayName: z.string().min(1),
    tier: PresetTierSettingSchema,
    masterIds: z.array(z.string().regex(masterIdRegex)),
    isBuiltIn: z.boolean(),
    isEnabled: z.boolean(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.tier !== "custom" && p.masterIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "非 custom 档位的 masterIds 不可为空",
        path: ["masterIds"],
      });
    }
    if (new Set(p.masterIds).size !== p.masterIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "masterIds 不可包含重复项",
        path: ["masterIds"],
      });
    }
  });

export const BrandSettingsBundleSchema = z
  .object({
    schemaVersion: z.literal(BRAND_SETTINGS_SCHEMA_VERSION),
    brands: z.array(BrandDefinitionSchema),
    colors: z.array(BrandColorDefinitionSchema),
    presets: z.array(BrandPresetDefinitionSchema),
  })
  .strict()
  .superRefine((data, ctx) => {
    const brandIds = new Set(data.brands.map((b) => b.id));
    for (const c of data.colors) {
      if (!brandIds.has(c.brandId)) {
        ctx.addIssue({
          code: "custom",
          message: `颜色引用了不存在的 brandId: ${c.brandId}`,
          path: ["colors"],
        });
        break;
      }
    }
    for (const p of data.presets) {
      if (!brandIds.has(p.brandId)) {
        ctx.addIssue({
          code: "custom",
          message: `套装引用了不存在的 brandId: ${p.brandId}`,
          path: ["presets"],
        });
        break;
      }
    }
    const colorKeys = new Set<string>();
    for (const c of data.colors) {
      const k = `${c.brandId}\0${c.masterId}`;
      if (colorKeys.has(k)) {
        ctx.addIssue({
          code: "custom",
          message: `颜色重复：品牌 ${c.brandId} + 主色 ${c.masterId}`,
          path: ["colors"],
        });
        break;
      }
      colorKeys.add(k);
    }
    const codeByBrand = new Map<string, Set<string>>();
    for (const c of data.colors) {
      if (c.brandCode === null || c.brandCode === "") continue;
      let set = codeByBrand.get(c.brandId);
      if (!set) {
        set = new Set();
        codeByBrand.set(c.brandId, set);
      }
      if (set.has(c.brandCode)) {
        ctx.addIssue({
          code: "custom",
          message: `品牌 ${c.brandId} 下品牌色号「${c.brandCode}」重复`,
          path: ["colors"],
        });
        break;
      }
      set.add(c.brandCode);
    }
    const presetIds = new Set<string>();
    for (const p of data.presets) {
      if (presetIds.has(p.id)) {
        ctx.addIssue({
          code: "custom",
          message: `套装 id 重复: ${p.id}`,
          path: ["presets"],
        });
        break;
      }
      presetIds.add(p.id);
    }
  });

export type BrandDefinition = z.infer<typeof BrandDefinitionSchema>;
export type BrandColorDefinition = z.infer<typeof BrandColorDefinitionSchema>;
export type BrandPresetDefinition = z.infer<typeof BrandPresetDefinitionSchema>;
export type BrandSettingsBundle = z.infer<typeof BrandSettingsBundleSchema>;
