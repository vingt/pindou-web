import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ALLOWED_MAPPING_EXTENSION_KEYS,
  BRAND_IDS,
  BrandMappingSchema,
  BrandPresetSchema,
  CocoStandardTierSchema,
  COCO_STANDARD_TIER_LEVELS,
  ManmanStandardTierSchema,
  MANMAN_STANDARD_TIER_LEVELS,
  MixiaowoStandardTierSchema,
  MIXIAOWO_STANDARD_TIER_LEVELS,
  MasterColorSchema,
  STANDARD_TIER_LEVELS,
  StandardTierSchema,
} from "@/modules/palette/schemas/palette-data-schema";

type MasterColor = {
  id: string;
};

type BrandMapping = Record<string, string | null>;
type BrandPreset = {
  presetId: string;
  brand: string;
  tier: number;
  source: string;
  availableMasterIds: string[];
};

async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

function pushError(errors: string[], message: string) {
  errors.push(`- ${message}`);
}

async function main() {
  const root = process.cwd();
  const errors: string[] = [];

  const masterPath = path.join(root, "src/data/palettes/mard221.master.json");
  const standardTierPath = path.join(root, "src/data/presets/standard-tiers.json");
  const cocoTierPath = path.join(root, "src/data/presets/coco-standard-tiers.json");
  const manmanTierPath = path.join(root, "src/data/presets/manman-standard-tiers.json");
  const mixiaowoTierPath = path.join(root, "src/data/presets/mixiaowo-standard-tiers.json");
  const mappingsDir = path.join(root, "src/data/mappings");
  const presetsDir = path.join(root, "src/data/presets");

  const masterPalette = await readJson<MasterColor[]>(masterPath);
  const standardTiers = await readJson<Record<string, string[]>>(standardTierPath);
  const cocoStandardTiers = await readJson<Record<string, string[]>>(cocoTierPath);
  const manmanStandardTiers = await readJson<Record<string, string[]>>(manmanTierPath);
  const mixiaowoStandardTiers = await readJson<Record<string, string[]>>(mixiaowoTierPath);

  // Schema checks
  for (const [idx, item] of masterPalette.entries()) {
    const parsed = MasterColorSchema.safeParse(item);
    if (!parsed.success) {
      pushError(errors, `master palette index ${idx} schema invalid`);
    }
  }
  {
    const parsed = StandardTierSchema.safeParse(standardTiers);
    if (!parsed.success) {
      pushError(errors, "standard tiers schema invalid");
    }
  }
  {
    const parsed = CocoStandardTierSchema.safeParse(cocoStandardTiers);
    if (!parsed.success) {
      pushError(errors, "coco standard tiers schema invalid");
    }
  }
  {
    const parsed = ManmanStandardTierSchema.safeParse(manmanStandardTiers);
    if (!parsed.success) {
      pushError(errors, "manman standard tiers schema invalid");
    }
  }
  {
    const parsed = MixiaowoStandardTierSchema.safeParse(mixiaowoStandardTiers);
    if (!parsed.success) {
      pushError(errors, "mixiaowo standard tiers schema invalid");
    }
  }

  // Master id legality + duplicates
  const masterIds = masterPalette.map((item) => item.id);
  const masterIdSet = new Set(masterIds);
  const duplicateMasterIds = masterIds.filter(
    (id, idx) => masterIds.indexOf(id) !== idx,
  );
  if (duplicateMasterIds.length > 0) {
    pushError(
      errors,
      `masterColor ids duplicated: ${[...new Set(duplicateMasterIds)].join(", ")}`,
    );
  }
  for (const id of masterIds) {
    if (!/^[A-Z]\d+$/.test(id)) {
      pushError(errors, `masterColor id illegal: ${id}`);
    }
  }

  // Standard tier 221 checks
  const tier221 = standardTiers["221"] ?? [];
  if (tier221.length !== 221) {
    pushError(errors, `standard tier 221 size must be 221, got ${tier221.length}`);
  }
  if (tier221.length !== masterPalette.length) {
    pushError(
      errors,
      `standard tier 221 size must equal master palette size (${masterPalette.length})`,
    );
  }
  const tier221Set = new Set(tier221);
  for (const id of masterIds) {
    if (!tier221Set.has(id)) {
      pushError(errors, `standard tier 221 missing master id: ${id}`);
    }
  }

  // Standard tier fixed-size + anti-prefix checks (24~144 must be curated lists)
  for (const tier of STANDARD_TIER_LEVELS) {
    const tierKey = String(tier) as `${(typeof STANDARD_TIER_LEVELS)[number]}`;
    const ids = standardTiers[tierKey] ?? [];
    if (ids.length !== tier) {
      pushError(errors, `standard tier ${tier} size must be ${tier}, got ${ids.length}`);
    }
    const duplicateTierIds = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    if (duplicateTierIds.length > 0) {
      pushError(
        errors,
        `standard tier ${tier} has duplicated ids: ${[...new Set(duplicateTierIds)].join(", ")}`,
      );
    }
  }

  for (const tier of [24, 48, 72, 96, 120, 144] as const) {
    const tierKey = String(tier) as `${(typeof STANDARD_TIER_LEVELS)[number]}`;
    const ids = standardTiers[tierKey] ?? [];
    const masterPrefix = masterIds.slice(0, tier);
    const isPrefixSlice =
      ids.length === masterPrefix.length &&
      ids.every((id, idx) => id === masterPrefix[idx]);
    if (isPrefixSlice) {
      pushError(
        errors,
        `standard tier ${tier} must be explicit curated list, but equals master prefix slice`,
      );
    }
  }

  for (const tier of COCO_STANDARD_TIER_LEVELS) {
    const tierKey = String(tier);
    const ids = cocoStandardTiers[tierKey] ?? [];
    if (ids.length !== tier) {
      pushError(
        errors,
        `coco standard tier ${tier} size must be ${tier}, got ${ids.length}`,
      );
    }
    const duplicateTierIds = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    if (duplicateTierIds.length > 0) {
      pushError(
        errors,
        `coco standard tier ${tier} has duplicated ids: ${[...new Set(duplicateTierIds)].join(", ")}`,
      );
    }
  }

  for (const tier of MANMAN_STANDARD_TIER_LEVELS) {
    const tierKey = String(tier);
    const ids = manmanStandardTiers[tierKey] ?? [];
    if (ids.length !== tier) {
      pushError(
        errors,
        `manman standard tier ${tier} size must be ${tier}, got ${ids.length}`,
      );
    }
    const duplicateTierIds = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    if (duplicateTierIds.length > 0) {
      pushError(
        errors,
        `manman standard tier ${tier} has duplicated ids: ${[...new Set(duplicateTierIds)].join(", ")}`,
      );
    }
  }

  for (const tier of MIXIAOWO_STANDARD_TIER_LEVELS) {
    const tierKey = String(tier);
    const ids = mixiaowoStandardTiers[tierKey] ?? [];
    if (ids.length !== tier) {
      pushError(
        errors,
        `mixiaowo standard tier ${tier} size must be ${tier}, got ${ids.length}`,
      );
    }
    const duplicateTierIds = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    if (duplicateTierIds.length > 0) {
      pushError(
        errors,
        `mixiaowo standard tier ${tier} has duplicated ids: ${[...new Set(duplicateTierIds)].join(", ")}`,
      );
    }
  }

  const allowedExtension = new Set<string>(ALLOWED_MAPPING_EXTENSION_KEYS);

  for (const brand of BRAND_IDS) {
    const mappingPath = path.join(mappingsDir, `${brand}.mapping.json`);
    const presetsPath = path.join(presetsDir, `${brand}.presets.json`);

    const mapping = await readJson<BrandMapping>(mappingPath);
    const presets = await readJson<BrandPreset[]>(presetsPath);

    {
      const parsed = BrandMappingSchema.safeParse(mapping);
      if (!parsed.success) {
        pushError(errors, `${brand}.mapping schema invalid`);
      }
    }

    // mapping key check and forbid literal "×"
    for (const [masterId, mappedBrandCode] of Object.entries(mapping)) {
      if (!masterIdSet.has(masterId) && !allowedExtension.has(masterId)) {
        pushError(errors, `${brand}.mapping has unknown key: ${masterId}`);
      }
      if (mappedBrandCode === "×") {
        pushError(errors, `${brand}.mapping ${masterId} contains forbidden value "×"`);
      }
    }

    for (const preset of presets) {
      const parsed = BrandPresetSchema.safeParse(preset);
      if (!parsed.success) {
        pushError(errors, `${brand}.presets ${preset.presetId} schema invalid`);
        continue;
      }

      // preset ids must be legal master keys
      for (const masterId of preset.availableMasterIds) {
        if (!masterIdSet.has(masterId) && !allowedExtension.has(masterId)) {
          pushError(
            errors,
            `${brand}.presets ${preset.presetId} has illegal availableMasterId: ${masterId}`,
          );
        }
      }

      // brand preset must be subset of corresponding tier catalog
      const tierKey = String(preset.tier);
      let catalogList: string[];
      if (brand === "coco") {
        catalogList = cocoStandardTiers[tierKey] ?? [];
      } else if (brand === "manman") {
        catalogList = manmanStandardTiers[tierKey] ?? [];
        if (catalogList.length === 0) {
          catalogList = standardTiers[tierKey] ?? [];
        }
      } else if (brand === "mixiaowo") {
        catalogList = mixiaowoStandardTiers[tierKey] ?? [];
        if (catalogList.length === 0) {
          catalogList = standardTiers[tierKey] ?? [];
        }
      } else {
        catalogList = standardTiers[tierKey] ?? [];
      }
      const catalogIds = new Set(catalogList);
      if (catalogIds.size === 0) {
        pushError(
          errors,
          `${brand}.presets ${preset.presetId} references unknown tier ${preset.tier} in catalog`,
        );
        continue;
      }
      const isSubset = preset.availableMasterIds.every((id) => catalogIds.has(id));
      if (!isSubset) {
        pushError(
          errors,
          `${brand}.presets ${preset.presetId} is not subset of tier catalog ${preset.tier}`,
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error("[check-palette-data] failed");
    console.error(errors.join("\n"));
    process.exit(1);
  }

  console.log("[check-palette-data] passed");
}

main().catch((error: unknown) => {
  console.error("[check-palette-data] crashed:", error);
  process.exit(1);
});
