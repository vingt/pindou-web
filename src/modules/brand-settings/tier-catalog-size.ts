import cocoStandardTiersJson from "@/data/presets/coco-standard-tiers.json";
import manmanStandardTiersJson from "@/data/presets/manman-standard-tiers.json";
import mixiaowoStandardTiersJson from "@/data/presets/mixiaowo-standard-tiers.json";
import standardTiersJson from "@/data/presets/standard-tiers.json";
import type { BrandPresetDefinition } from "@/modules/brand-settings/schema";

const STANDARD_TIERS = standardTiersJson as Record<string, string[]>;
const COCO_TIERS = cocoStandardTiersJson as Record<string, string[]>;
const MANMAN_TIERS = manmanStandardTiersJson as Record<string, string[]>;
const MIXIAOWO_TIERS = mixiaowoStandardTiersJson as Record<string, string[]>;

/**
 * 该品牌该档位在目录中的主色数量（与 `getTierCatalogMasterIds` 一致，不依赖当前 bundle）。
 */
export function getTierCatalogSizeForBrand(
  brandId: string,
  tier: BrandPresetDefinition["tier"],
): number | null {
  if (tier === "custom") return null;
  const key = String(tier);
  if (brandId === "coco") {
    const list = COCO_TIERS[key];
    return list?.length ?? null;
  }
  if (brandId === "manman") {
    const mm = MANMAN_TIERS[key];
    if (mm?.length) return mm.length;
  }
  if (brandId === "mixiaowo") {
    const mx = MIXIAOWO_TIERS[key];
    if (mx?.length) return mx.length;
  }
  const st = STANDARD_TIERS[key];
  return st?.length ?? null;
}

/** 标准档位套装是否视为「颜色齐全」可用（自定义档始终可用）。 */
export function isTierPresetMasterListComplete(
  brandId: string,
  tier: BrandPresetDefinition["tier"],
  masterIdsLength: number,
): boolean {
  if (tier === "custom") return true;
  const expected = getTierCatalogSizeForBrand(brandId, tier);
  if (expected === null || expected <= 0) return false;
  return masterIdsLength === expected;
}
