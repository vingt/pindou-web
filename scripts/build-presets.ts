import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BRAND_IDS,
  COCO_STANDARD_TIER_LEVELS,
  MANMAN_STANDARD_TIER_LEVELS,
  MIXIAOWO_STANDARD_TIER_LEVELS,
  STANDARD_TIER_LEVELS,
} from "@/modules/palette/schemas/palette-data-schema";

type BrandId = (typeof BRAND_IDS)[number];

type StandardTierNum = (typeof STANDARD_TIER_LEVELS)[number];
type CocoTierNum = (typeof COCO_STANDARD_TIER_LEVELS)[number];
type ManmanTierNum = (typeof MANMAN_STANDARD_TIER_LEVELS)[number];
type MixiaowoTierNum = (typeof MIXIAOWO_STANDARD_TIER_LEVELS)[number];

type MappingTable = Record<string, string | null>;

type PresetRecord = {
  presetId: string;
  brand: BrandId;
  tier: StandardTierNum | CocoTierNum | ManmanTierNum | MixiaowoTierNum;
  source: "standard-tier";
  availableMasterIds: string[];
};

const BRANDS: BrandId[] = [...BRAND_IDS];

const MANMAN_LAYOUT_TIER_SET = new Set<number>(MANMAN_STANDARD_TIER_LEVELS);
const MIXIAOWO_LAYOUT_TIER_SET = new Set<number>(MIXIAOWO_STANDARD_TIER_LEVELS);

async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

async function main() {
  const root = process.cwd();
  const presetsDir = path.join(root, "src/data/presets");
  const mappingsDir = path.join(root, "src/data/mappings");

  const standardTiersPath = path.join(presetsDir, "standard-tiers.json");
  const cocoTiersPath = path.join(presetsDir, "coco-standard-tiers.json");
  const manmanTiersPath = path.join(presetsDir, "manman-standard-tiers.json");
  const mixiaowoTiersPath = path.join(presetsDir, "mixiaowo-standard-tiers.json");
  const standardTiers = await readJson<Record<string, string[]>>(standardTiersPath);
  const cocoTiers = await readJson<Record<string, string[]>>(cocoTiersPath);
  const manmanTiers = await readJson<Record<string, string[]>>(manmanTiersPath);
  const mixiaowoTiers = await readJson<Record<string, string[]>>(mixiaowoTiersPath);

  await mkdir(presetsDir, { recursive: true });

  for (const brand of BRANDS) {
    const mappingPath = path.join(mappingsDir, `${brand}.mapping.json`);
    const mapping = await readJson<MappingTable>(mappingPath);

    const tiers: (StandardTierNum | CocoTierNum | ManmanTierNum | MixiaowoTierNum)[] =
      brand === "coco"
        ? [...COCO_STANDARD_TIER_LEVELS]
        : brand === "manman"
          ? [...MANMAN_STANDARD_TIER_LEVELS, ...([216, 221, 264] as const)]
          : brand === "mixiaowo"
            ? [...MIXIAOWO_STANDARD_TIER_LEVELS, ...([264] as const)]
            : [...STANDARD_TIER_LEVELS]; // mard、panpan 等：仅 standard-tiers.json

    const presets: PresetRecord[] = tiers.map((tier) => {
      const key = String(tier);
      const tierIds =
        brand === "coco"
          ? (cocoTiers[key] ?? [])
          : brand === "manman" && MANMAN_LAYOUT_TIER_SET.has(tier)
            ? (manmanTiers[key] ?? [])
            : brand === "mixiaowo" && MIXIAOWO_LAYOUT_TIER_SET.has(tier)
              ? (mixiaowoTiers[key] ?? [])
              : (standardTiers[key] ?? []);

      let availableMasterIds: string[];
      if (brand === "mard") {
        availableMasterIds = tierIds;
      } else if (brand === "manman" && MANMAN_LAYOUT_TIER_SET.has(tier)) {
        availableMasterIds = tierIds;
      } else if (brand === "mixiaowo" && MIXIAOWO_LAYOUT_TIER_SET.has(tier)) {
        availableMasterIds = tierIds;
      } else {
        availableMasterIds = tierIds.filter((masterId) => mapping[masterId] != null);
      }

      return {
        presetId: `${brand}_${tier}`,
        brand,
        tier,
        source: "standard-tier",
        availableMasterIds,
      };
    });

    const outPath = path.join(presetsDir, `${brand}.presets.json`);
    await writeFile(outPath, `${JSON.stringify(presets, null, 2)}\n`, "utf-8");

    const tier48 = presets.find((item) => item.tier === 48);
    console.log(
      `[build-presets] ${brand}: tier48=${tier48?.availableMasterIds.length ?? 0}`,
    );
  }

  console.log("[build-presets] done");
}

main().catch((error: unknown) => {
  console.error("[build-presets] failed:", error);
  process.exit(1);
});
