import { z } from "zod";
import type { BrandPresetId } from "@/types";
import { normalizeGenerationConfig } from "@/types/project";

/** Bump only with migration or coordinated app release. */
export const PATTERN_PROJECT_FORMAT_VERSION = 1 as const;

export const SUPPORTED_PATTERN_PROJECT_VERSIONS = [1] as const;

const brandIdSchema = z.string().regex(/^[a-z][a-z0-9_-]*$/);

const tierSchema = z.union([
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

const presetIdSchema = z.string().min(1);

const generationModeSchema = z.enum(["strict-preset", "allow-refill"]);

const optimizationConfigSchema = z
  .object({
    processingMode: z.enum(["standard", "detail", "easy", "poster"]),
    dithering: z.enum(["none", "floyd-steinberg", "atkinson", "bayer"]),
    minColorUsageMergeThreshold: z.number().int().min(0).max(9999),
    cleanIsolatedPixels: z.boolean(),
    mergeSimilarColors: z.boolean().optional(),
    similarColorDistanceThreshold: z.number().min(0).max(441).optional(),
    mergeSmallRegions: z.boolean().optional(),
    smallRegionAreaThreshold: z.number().int().min(1).max(9999).optional(),
    simplifyBackground: z.boolean().optional(),
    maxRefillColors: z.union([z.number().int().min(0).max(999), z.null()]).optional(),
  })
  .strict();

export const GenerationConfigSchema = z
  .object({
    brand: brandIdSchema,
    tier: tierSchema,
    presetId: presetIdSchema,
    generationMode: generationModeSchema,
    compareOriginal: z.boolean(),
    targetGridWidth: z.number().int().min(8).max(500).optional(),
    targetGridHeight: z.number().int().min(8).max(500).optional(),
    optimization: optimizationConfigSchema.optional(),
    customPaletteMasterIds: z.array(z.string()).optional(),
  })
  .strict()
  .transform((raw) =>
    normalizeGenerationConfig({
      brand: raw.brand,
      tier: raw.tier,
      presetId: raw.presetId as BrandPresetId,
      generationMode: raw.generationMode,
      compareOriginal: raw.compareOriginal,
      targetGridWidth: raw.targetGridWidth,
      targetGridHeight: raw.targetGridHeight,
      optimization: raw.optimization,
      customPaletteMasterIds: raw.customPaletteMasterIds,
    }),
  );

const patternCellSchema = z
  .object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    masterColorId: z.union([z.string(), z.null()]),
  })
  .strict();

export const PatternGenerationResultSchema = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    cells: z.array(z.array(patternCellSchema)),
    usedMasterIds: z.array(z.string()),
    totalBeads: z.number().int().nonnegative(),
    filledBeads: z.number().int().nonnegative(),
    usedColorCount: z.number().int().nonnegative(),
    paletteCandidateCount: z.number().int().nonnegative().optional(),
    sourceImageWidth: z.number().int().positive().optional(),
    sourceImageHeight: z.number().int().positive().optional(),
    optimizationMeta: z
      .object({
        processingMode: z.string(),
        dithering: z.string(),
        minColorUsageMergeThreshold: z.number(),
        cleanIsolatedPixels: z.boolean(),
        usedColorCountAfterQuantize: z.number(),
        usedColorCountAfterMerge: z.number(),
        usedColorCountFinal: z.number(),
        mergedMasterIdsCount: z.number(),
        mergeSimilarColors: z.boolean().optional(),
        similarColorDistanceThreshold: z.number().optional(),
        mergeSmallRegions: z.boolean().optional(),
        smallRegionAreaThreshold: z.number().optional(),
        simplifyBackground: z.boolean().optional(),
        maxRefillColors: z.union([z.number(), z.null()]).optional(),
        usedColorCountBeforeSimilarMerge: z.number().optional(),
        usedColorCountAfterSimilarMerge: z.number().optional(),
        similarMergeSourceMasterIdsCount: z.number().optional(),
        smallRegionsMergedCount: z.number().optional(),
        simplifyBackgroundRegionsMergedCount: z.number().optional(),
        distinctRefillMasterIdsFinal: z.number().optional(),
        recycledRefillMasterIdsCount: z.number().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const missingColorItemSchema = z
  .object({
    masterId: z.string(),
    brandCode: z.union([z.string(), z.null()]),
    neededCount: z.number().int().nonnegative(),
    inPreset: z.boolean(),
    canBuyInCurrentBrand: z.boolean(),
    alternativeMappings: z
      .array(
        z
          .object({
            brand: z.string(),
            code: z.union([z.string(), z.null()]),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export const MissingColorAnalysisSchema = z
  .object({
    missingColorCount: z.number().int().nonnegative(),
    missingBeads: z.number().int().nonnegative(),
    coveredColorCount: z.number().int().nonnegative(),
    coveredBeads: z.number().int().nonnegative(),
    coverageRate: z.number(),
    status: z.enum(["fully-covered", "needs-refill"]),
    missingItems: z.array(missingColorItemSchema),
  })
  .strict();

export const ProjectSourceImageMetaSchema = z
  .object({
    fileName: z.union([z.string(), z.null()]),
    width: z.number().int().nonnegative(),
    height: z.number().int().nonnegative(),
    mimeType: z.union([z.string(), z.null()]).optional(),
    imageDataUrl: z.union([z.string(), z.null()]).optional(),
  })
  .strict();

/** v1 wire schema — strict for predictable import/export. */
export const PatternProjectSchema = z
  .object({
    version: z.literal(PATTERN_PROJECT_FORMAT_VERSION),
    id: z.string().min(1),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    sourceImage: ProjectSourceImageMetaSchema,
    generationConfig: GenerationConfigSchema,
    generationResult: PatternGenerationResultSchema.nullable(),
    missingColorAnalysis: MissingColorAnalysisSchema.nullable(),
  })
  .strict();

export type PatternProjectParsed = z.infer<typeof PatternProjectSchema>;

export type DeserializeProjectResult =
  | { ok: true; project: PatternProjectParsed }
  | { ok: false; error: string };

export function deserializeProjectUnknown(data: unknown): DeserializeProjectResult {
  const versionProbe = z
    .object({ version: z.number().int() })
    .safeParse(data);
  if (!versionProbe.success) {
    return { ok: false, error: "项目文件格式无效（缺少 version）。" };
  }
  const v = versionProbe.data.version;
  if (!SUPPORTED_PATTERN_PROJECT_VERSIONS.includes(v as 1)) {
    return {
      ok: false,
      error: `项目文件版本为 v${v}，当前应用仅支持 v${SUPPORTED_PATTERN_PROJECT_VERSIONS.join(", ")}。请升级应用后再试。`,
    };
  }
  const parsed = PatternProjectSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("；");
    return { ok: false, error: `项目数据校验失败：${msg}` };
  }
  return { ok: true, project: parsed.data };
}
