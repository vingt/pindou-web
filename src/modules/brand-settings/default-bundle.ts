import { BRAND_LABELS } from "@/data/branding/brand-labels";
import masterPalette from "@/data/palettes/mard221.master.json";
import extensionColorOverrides from "@/data/palettes/extension-color-overrides.json";
import mardMapping from "@/data/mappings/mard.mapping.json";
import cocoMapping from "@/data/mappings/coco.mapping.json";
import manmanMapping from "@/data/mappings/manman.mapping.json";
import panpanMapping from "@/data/mappings/panpan.mapping.json";
import mixiaowoMapping from "@/data/mappings/mixiaowo.mapping.json";
import cocoStandardTiersJson from "@/data/presets/coco-standard-tiers.json";
import manmanStandardTiersJson from "@/data/presets/manman-standard-tiers.json";
import mixiaowoStandardTiersJson from "@/data/presets/mixiaowo-standard-tiers.json";
import standardTiersJson from "@/data/presets/standard-tiers.json";
import {
  BRAND_IDS,
  MANMAN_STANDARD_TIER_LEVELS,
  MIXIAOWO_STANDARD_TIER_LEVELS,
} from "@/modules/palette/schemas/palette-data-schema";
import {
  BRAND_SETTINGS_SCHEMA_VERSION,
  type BrandColorDefinition,
  type BrandDefinition,
  type BrandPresetDefinition,
  type BrandSettingsBundle,
} from "./schema";

type MasterRow = {
  id: string;
  hex: string;
  r: number;
  g: number;
  b: number;
};

type MappingTable = Record<string, string | null>;

type OverrideRow = { hex: string; r: number; g: number; b: number };

const MASTER_COLORS = masterPalette as MasterRow[];
const MASTER_BY_ID = new Map(MASTER_COLORS.map((c) => [c.id, c]));
const OVERRIDES = extensionColorOverrides as Record<string, OverrideRow>;

const STANDARD_TIERS = standardTiersJson as Record<string, string[]>;
const COCO_STANDARD_TIERS = cocoStandardTiersJson as Record<string, string[]>;
const MANMAN_STANDARD_TIERS = manmanStandardTiersJson as Record<string, string[]>;
const MIXIAOWO_STANDARD_TIERS = mixiaowoStandardTiersJson as Record<string, string[]>;

/** MARD 与盼盼共用：`standard-tiers.json` + 档位顺序；盼盼预设 = 标准档主色 ∩ 盼盼映射（无独立套装表）。 */
const MARD_TIER_ORDER = [24, 48, 72, 96, 120, 144, 216, 221, 264] as const;
const COCO_TIER_ORDER = [24, 48, 72, 96, 120, 144, 168, 192, 221, 293] as const;
const MANMAN_TIER_ORDER = [...MANMAN_STANDARD_TIER_LEVELS, 216, 221, 264] as const;
const MIXIAOWO_TIER_ORDER = [...MIXIAOWO_STANDARD_TIER_LEVELS, 264] as const;

const MANMAN_LAYOUT_TIER_SET = new Set<number>(MANMAN_STANDARD_TIER_LEVELS);
const MIXIAOWO_LAYOUT_TIER_SET = new Set<number>(MIXIAOWO_STANDARD_TIER_LEVELS);

const MAPPINGS: Record<(typeof BRAND_IDS)[number], MappingTable> = {
  mard: mardMapping as MappingTable,
  coco: cocoMapping as MappingTable,
  manman: manmanMapping as MappingTable,
  panpan: panpanMapping as MappingTable,
  mixiaowo: mixiaowoMapping as MappingTable,
};

function masterRgb(masterId: string): Pick<BrandColorDefinition, "hex" | "r" | "g" | "b"> {
  const o = OVERRIDES[masterId];
  if (o) {
    return { hex: o.hex, r: o.r, g: o.g, b: o.b };
  }
  const m = MASTER_BY_ID.get(masterId);
  if (m) {
    return { hex: m.hex, r: m.r, g: m.g, b: m.b };
  }
  return { hex: "#888888", r: 136, g: 136, b: 136 };
}

function getTierCatalogMasterIds(
  brand: (typeof BRAND_IDS)[number],
  tier: number,
): string[] {
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
  const list = STANDARD_TIERS[key];
  if (!list?.length) {
    throw new Error(`Missing standard tier definition: ${key}`);
  }
  return list;
}

function buildAvailableMasterIds(
  brand: (typeof BRAND_IDS)[number],
  tier: number,
): string[] {
  const catalog = getTierCatalogMasterIds(brand, tier);
  if (brand === "mard") {
    return [...catalog];
  }
  if (brand === "manman" && MANMAN_LAYOUT_TIER_SET.has(tier)) {
    return [...catalog];
  }
  if (brand === "mixiaowo" && MIXIAOWO_LAYOUT_TIER_SET.has(tier)) {
    return [...catalog];
  }
  const mapping = MAPPINGS[brand];
  return catalog.filter((id) => mapping[id] != null);
}

function buildColorsForBrand(brand: (typeof BRAND_IDS)[number]): BrandColorDefinition[] {
  const mapping = MAPPINGS[brand];
  const out: BrandColorDefinition[] = [];
  for (const [masterId, brandCode] of Object.entries(mapping)) {
    const rgb = masterRgb(masterId);
    out.push({
      brandId: brand,
      brandCode,
      ...rgb,
      masterId,
      isEnabled: true,
      isBuiltIn: true,
    });
  }
  return out;
}

function buildPresetsForBrand(brand: (typeof BRAND_IDS)[number]): BrandPresetDefinition[] {
  const order =
    brand === "coco"
      ? COCO_TIER_ORDER
      : brand === "manman"
        ? MANMAN_TIER_ORDER
        : brand === "mixiaowo"
          ? MIXIAOWO_TIER_ORDER
          : MARD_TIER_ORDER;
  const presets: BrandPresetDefinition[] = order.map((tier) => ({
    id: `${brand}_${tier}`,
    brandId: brand,
    displayName: `${tier} 色`,
    tier,
    masterIds: buildAvailableMasterIds(brand, tier),
    isBuiltIn: true,
    isEnabled: true,
  }));
  presets.push({
    id: `${brand}_custom`,
    brandId: brand,
    displayName: "自定义色板",
    tier: "custom",
    masterIds: [],
    isBuiltIn: true,
    isEnabled: true,
  });
  return presets;
}

/**
 * Built-in defaults: same mapping/tier semantics as the legacy JSON assets.
 * Used as initial bundle and as “恢复默认”.
 */
export function buildDefaultBrandSettingsBundle(): BrandSettingsBundle {
  const brands: BrandDefinition[] = BRAND_IDS.map((id, index) => ({
    id,
    displayName: BRAND_LABELS[id] ?? id,
    isBuiltIn: true,
    isEnabled: true,
    sortOrder: index,
    isCanonical: id === "mard",
  }));

  const colors: BrandColorDefinition[] = BRAND_IDS.flatMap((b) => buildColorsForBrand(b));
  const presets: BrandPresetDefinition[] = BRAND_IDS.flatMap((b) => buildPresetsForBrand(b));

  return {
    schemaVersion: BRAND_SETTINGS_SCHEMA_VERSION,
    brands,
    colors,
    presets,
  };
}
