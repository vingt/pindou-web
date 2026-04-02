import { getAlternativeBrandIdsOrdered } from "@/modules/brand-settings/alternatives-order";
import { isCanonicalMasterBrandId } from "@/modules/brand-settings/selectors";
import {
  getBrandCode,
  getStandardTierMasterIds,
  resolvePresetDefinition,
} from "@/modules/palette/services";
import type {
  BrandId,
  BrandPresetId,
  GenerationMode,
  MissingColorAnalysis,
  MissingColorItem,
  PatternGenerationResult,
  PresetTier,
} from "@/types";

const MAX_ALTERNATIVES = 3;

function collectAlternativeMappings(
  masterId: string,
  currentBrand: BrandId,
): MissingColorItem["alternativeMappings"] {
  const out: NonNullable<MissingColorItem["alternativeMappings"]> = [];
  for (const b of getAlternativeBrandIdsOrdered(currentBrand)) {
    const code = getBrandCode(b, masterId);
    if (code !== null) {
      out.push({ brand: b, code });
      if (out.length >= MAX_ALTERNATIVES) break;
    }
  }
  return out.length > 0 ? out : undefined;
}

function fullyCovered(result: PatternGenerationResult): MissingColorAnalysis {
  const filledBeads = result.filledBeads;
  return {
    missingColorCount: 0,
    missingBeads: 0,
    coveredColorCount: result.usedMasterIds.length,
    coveredBeads: filledBeads,
    coverageRate: filledBeads > 0 ? 1 : 1,
    status: "fully-covered",
    missingItems: [],
  };
}

export function analyzeMissingColors(params: {
  generationResult: PatternGenerationResult;
  brand: BrandId;
  tier: PresetTier;
  presetId: BrandPresetId;
  generationMode: GenerationMode;
  customPaletteMasterIds?: string[];
}): MissingColorAnalysis {
  void params.presetId;
  const { generationResult, brand, tier, generationMode } = params;
  if (generationMode === "strict-preset") {
    return fullyCovered(generationResult);
  }

  const filledBeads = generationResult.filledBeads;

  const preset = resolvePresetDefinition(
    brand,
    tier,
    params.customPaletteMasterIds ?? [],
  );
  const presetIds = preset?.availableMasterIds ?? [];
  const presetSet = new Set(presetIds);
  const canonicalPurchasableSet = isCanonicalMasterBrandId(brand)
    ? new Set(getStandardTierMasterIds(221))
    : null;

  const masterCounts = new Map<string, number>();
  for (const row of generationResult.cells) {
    for (const cell of row) {
      const id = cell.masterColorId;
      if (id === null) continue;
      masterCounts.set(id, (masterCounts.get(id) ?? 0) + 1);
    }
  }

  let coveredBeads = 0;
  const coveredMasterIds = new Set<string>();
  const missingRows: Array<{
    masterId: string;
    neededCount: number;
  }> = [];

  for (const [masterId, count] of masterCounts) {
    if (presetSet.has(masterId)) {
      coveredBeads += count;
      coveredMasterIds.add(masterId);
    } else {
      missingRows.push({ masterId, neededCount: count });
    }
  }

  const missingBeads = filledBeads - coveredBeads;
  const coverageRate = filledBeads > 0 ? coveredBeads / filledBeads : 1;

  missingRows.sort((a, b) => b.neededCount - a.neededCount);

  const missingItems: MissingColorItem[] = missingRows.map((row) => {
    const brandCode = getBrandCode(brand, row.masterId);
    const canBuyInCurrentBrand = canonicalPurchasableSet
      ? Boolean(canonicalPurchasableSet.has(row.masterId))
      : brandCode !== null;
    return {
      masterId: row.masterId,
      brandCode,
      neededCount: row.neededCount,
      inPreset: false,
      canBuyInCurrentBrand,
      alternativeMappings: collectAlternativeMappings(row.masterId, brand),
    };
  });

  const status =
    missingItems.length === 0 ? "fully-covered" : "needs-refill";

  return {
    missingColorCount: missingItems.length,
    missingBeads,
    coveredColorCount: coveredMasterIds.size,
    coveredBeads,
    coverageRate,
    status,
    missingItems,
  };
}
