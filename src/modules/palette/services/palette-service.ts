import type { BrandId, BrandPresetTier, PresetTier } from "@/types";
import masterPalette from "@/data/palettes/mard221.master.json";
import extensionColorOverrides from "@/data/palettes/extension-color-overrides.json";
import cocoStandardTiersJson from "@/data/presets/coco-standard-tiers.json";
import manmanStandardTiersJson from "@/data/presets/manman-standard-tiers.json";
import mixiaowoStandardTiersJson from "@/data/presets/mixiaowo-standard-tiers.json";
import standardTiersJson from "@/data/presets/standard-tiers.json";
import { getActiveBrandSettingsBundle } from "@/modules/brand-settings/runtime";
import {
  findFirstEnabledPresetForTier,
} from "@/modules/brand-settings/selectors";

type MasterPaletteColor = {
  id: string;
  group: string;
  index: number;
  hex: string;
  r: number;
  g: number;
  b: number;
};

type BrandMappingTable = Record<string, string | null>;
type ExtensionColorOverride = {
  hex: string;
  r: number;
  g: number;
  b: number;
};

type StandardTiersFile = Record<string, string[]>;

export type PresetSource = "standard-tier" | "brand-specific" | "custom";

export type PresetDefinition = {
  presetId: string;
  brand: BrandId;
  tier: PresetTier;
  source: PresetSource;
  availableMasterIds: string[];
};

const MASTER_COLORS = masterPalette as MasterPaletteColor[];
const MASTER_BY_ID = new Map(MASTER_COLORS.map((item) => [item.id, item]));
const MASTER_IDS = MASTER_COLORS.map((item) => item.id);

const EXTENSION_OVERRIDES = extensionColorOverrides as Record<string, ExtensionColorOverride>;

const EXTENSION_COLORS: MasterPaletteColor[] = Object.entries(EXTENSION_OVERRIDES).map(
  ([id, row]) => {
    const m = id.match(/^([A-Z]+)(\d+)$/);
    const group = m?.[1] ?? "X";
    const index = Number.parseInt(m?.[2] ?? "1", 10);
    return {
      id,
      group,
      index: Number.isFinite(index) ? index : 1,
      hex: row.hex,
      r: row.r,
      g: row.g,
      b: row.b,
    };
  },
);

const EXTENSION_BY_ID = new Map(EXTENSION_COLORS.map((item) => [item.id, item]));
const ALL_MASTER_COLORS = [...MASTER_COLORS, ...EXTENSION_COLORS];

const STANDARD_TIERS = standardTiersJson as StandardTiersFile;
const COCO_STANDARD_TIERS = cocoStandardTiersJson as StandardTiersFile;
const MANMAN_STANDARD_TIERS = manmanStandardTiersJson as StandardTiersFile;
const MIXIAOWO_STANDARD_TIERS = mixiaowoStandardTiersJson as StandardTiersFile;

/** Master groups used in mapping tables (includes extension keys beyond 221 master file). */
export const MAPPING_GROUP_LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "L",
  "M",
  "N",
  "P",
  "R",
  "T",
  "W",
  "Y",
] as const;

export type MappingGroupLetter = (typeof MAPPING_GROUP_LETTERS)[number];

function mappingTableForBrand(brand: string): BrandMappingTable {
  const bundle = getActiveBrandSettingsBundle();
  const table: BrandMappingTable = {};
  for (const c of bundle.colors) {
    if (c.brandId !== brand || !c.isEnabled) continue;
    table[c.masterId] = c.brandCode;
  }
  return table;
}

/** MARD 标准档（`standard-tiers.json`）；不含 COCO 专有 168/192/293。 */
export function getStandardTierMasterIds(tier: BrandPresetTier): string[] {
  const key = String(tier);
  const list = STANDARD_TIERS[key];
  if (!list?.length) {
    throw new Error(`Missing standard tier definition: ${key}`);
  }
  return list;
}

/** 按品牌的档位主色列表（COCO 用 `coco-standard-tiers.json`）。 */
export function getTierCatalogMasterIds(brand: BrandId, tier: BrandPresetTier): string[] {
  const key = String(tier);
  if (brand === "coco") {
    const list = COCO_STANDARD_TIERS[key];
    if (!list?.length) {
      throw new Error(`Missing COCO tier catalog: ${key}`);
    }
    return list;
  }
  if (brand === "manman") {
    const mm = MANMAN_STANDARD_TIERS[key];
    if (mm?.length) {
      return mm;
    }
  }
  if (brand === "mixiaowo") {
    const mx = MIXIAOWO_STANDARD_TIERS[key];
    if (mx?.length) {
      return mx;
    }
  }
  return getStandardTierMasterIds(tier);
}

export function getStandardTierHeadIds(tier: BrandPresetTier, count = 10) {
  return getStandardTierMasterIds(tier).slice(0, count);
}

export function getTierCatalogHeadIds(brand: BrandId, tier: BrandPresetTier, count = 10) {
  return getTierCatalogMasterIds(brand, tier).slice(0, count);
}

export function isStandardTierLikelyMasterPrefixSlice(
  tier: BrandPresetTier,
  catalogBrand: BrandId = "mard",
) {
  if (tier === 221) return false;
  if (catalogBrand !== "mard") return false;
  const ids = getStandardTierMasterIds(tier);
  const masterPrefix = MASTER_IDS.slice(0, tier);
  return (
    ids.length === masterPrefix.length &&
    ids.every((id, index) => id === masterPrefix[index])
  );
}

function presetDefFromBundle(
  brand: string,
  preset: {
    id: string;
    tier: PresetTier;
    masterIds: string[];
    isBuiltIn: boolean;
  },
): PresetDefinition {
  const source: PresetSource =
    preset.tier === "custom"
      ? "custom"
      : preset.isBuiltIn
        ? "standard-tier"
        : "brand-specific";
  return {
    presetId: preset.id,
    brand: brand as BrandId,
    tier: preset.tier,
    source,
    availableMasterIds: [...preset.masterIds],
  };
}

/**
 * 当前品牌可购/可用的全部主色（用于自定义色板候选与 allow-refill 全量）。
 */
export function getBrandFullPurchasableMasterIds(brand: string): string[] {
  const mapping = mappingTableForBrand(brand);
  return Object.entries(mapping)
    .filter(([, mapped]) => mapped !== null)
    .map(([masterId]) => masterId)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * 标准档位读 settings 预设；`custom` 用 store 中的主色列表（已过滤非法项）。
 */
export function resolvePresetDefinition(
  brand: string,
  tier: PresetTier,
  customMasterIds: string[],
): PresetDefinition | null {
  const bundle = getActiveBrandSettingsBundle();
  if (tier !== "custom") {
    const preset = findFirstEnabledPresetForTier(brand, tier, bundle);
    if (!preset) return null;
    return presetDefFromBundle(brand, preset);
  }
  const selectable = new Set(getBrandFullPurchasableMasterIds(brand));
  const ids = [...new Set(customMasterIds)].filter((id) => selectable.has(id));
  if (ids.length === 0) return null;
  const customRow = bundle.presets.find(
    (p) => p.brandId === brand && p.tier === "custom" && p.isEnabled,
  );
  return {
    presetId: customRow?.id ?? `${brand}_custom`,
    brand: brand as BrandId,
    tier: "custom",
    source: "custom",
    availableMasterIds: ids,
  };
}

/**
 * How preset lists are derived. `custom` is reserved for UI-defined kits (not in JSON yet).
 */
export function getPresetSource(brand: string): PresetSource {
  void brand;
  return "standard-tier";
}

export function isBrandPresetSubsetOfStandardTier(
  brand: string,
  tier: BrandPresetTier,
): boolean {
  const preset = getPreset(brand, tier);
  if (!preset) return false;
  const key = String(tier);
  let list: string[] | undefined;
  if (brand === "coco") {
    list = COCO_STANDARD_TIERS[key];
  } else if (brand === "manman") {
    list = MANMAN_STANDARD_TIERS[key];
    if (!list?.length) {
      list = STANDARD_TIERS[key];
    }
  } else if (brand === "mixiaowo") {
    list = MIXIAOWO_STANDARD_TIERS[key];
    if (!list?.length) {
      list = STANDARD_TIERS[key];
    }
  } else {
    list = STANDARD_TIERS[key];
  }
  if (!list?.length) return false;
  const catalog = new Set(list);
  return preset.availableMasterIds.every((id) => catalog.has(id));
}

export function getMappedCountByMasterGroup(
  brand: string,
): Record<MappingGroupLetter, number> {
  const mapping = mappingTableForBrand(brand);
  const result = {} as Record<MappingGroupLetter, number>;
  for (const letter of MAPPING_GROUP_LETTERS) {
    const prefix = letter;
    let n = 0;
    for (const [key, value] of Object.entries(mapping)) {
      if (value === null) continue;
      const m = key.match(/^([A-Z])(\d+)$/);
      if (!m || m[1] !== prefix) continue;
      n += 1;
    }
    result[letter] = n;
  }
  return result;
}

export function getMasterPalette() {
  return ALL_MASTER_COLORS;
}

export function getMasterColorById(masterId: string) {
  return MASTER_BY_ID.get(masterId) ?? EXTENSION_BY_ID.get(masterId) ?? null;
}

export function getBrandMapping(brand: string) {
  return mappingTableForBrand(brand);
}

export function getBrandCode(brand: string, masterId: string) {
  const mapping = getBrandMapping(brand);
  return mapping[masterId] ?? null;
}

export function isColorAvailableInBrand(brand: string, masterId: string) {
  return getBrandCode(brand, masterId) !== null;
}

export function getPreset(brand: string, tier: BrandPresetTier) {
  const preset = findFirstEnabledPresetForTier(brand, tier);
  if (!preset) return null;
  return presetDefFromBundle(brand, preset);
}

export function isColorInPreset(
  brand: string,
  tier: BrandPresetTier,
  masterId: string,
) {
  const preset = getPreset(brand, tier);
  return preset ? preset.availableMasterIds.includes(masterId) : false;
}

export function getAvailableMasterIdsForPreset(
  brand: string,
  tier: BrandPresetTier,
) {
  const preset = getPreset(brand, tier);
  return preset?.availableMasterIds ?? [];
}

export function searchMasterColorsById(keyword: string) {
  const normalized = keyword.trim().toUpperCase();
  if (!normalized) return [];
  return ALL_MASTER_COLORS.filter((item) => item.id.includes(normalized));
}

export function searchMasterColorsByHex(keyword: string) {
  const normalized = keyword.trim().toLowerCase().replace(/^#/, "");
  if (!normalized) return [];
  return ALL_MASTER_COLORS.filter((item) =>
    item.hex.toLowerCase().replace(/^#/, "").includes(normalized),
  );
}
