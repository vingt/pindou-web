"use client";

import { useMemo, useState } from "react";
import {
  getBrandCode,
  getMappedCountByMasterGroup,
  getMasterColorById,
  getMasterPalette,
  getPreset,
  getPresetSource,
  getStandardTierHeadIds,
  getStandardTierMasterIds,
  getTierCatalogHeadIds,
  getTierCatalogMasterIds,
  isStandardTierLikelyMasterPrefixSlice,
  isBrandPresetSubsetOfStandardTier,
  isColorInPreset,
  MAPPING_GROUP_LETTERS,
} from "@/modules/palette/services";
import { BRAND_LABELS } from "@/data/branding/brand-labels";
import type { BrandId, BrandPresetTier } from "@/types";
import mardMapping from "@/data/mappings/mard.mapping.json";
import cocoMapping from "@/data/mappings/coco.mapping.json";
import manmanMapping from "@/data/mappings/manman.mapping.json";
import panpanMapping from "@/data/mappings/panpan.mapping.json";
import mixiaowoMapping from "@/data/mappings/mixiaowo.mapping.json";

const BRAND_OPTIONS: BrandId[] = ["mard", "coco", "manman", "panpan", "mixiaowo"];

const BRAND_MAPPINGS: Record<BrandId, Record<string, string | null>> = {
  mard: mardMapping,
  coco: cocoMapping,
  manman: manmanMapping,
  panpan: panpanMapping,
  mixiaowo: mixiaowoMapping,
};

const SAMPLE_KEYS = ["A1", "B12", "H7", "M15", "P3", "R18", "T1", "Y4"] as const;
const MARD_CATALOG_TIERS: BrandPresetTier[] = [24, 48, 72, 96, 120, 144, 216, 221, 264];
const COCO_CATALOG_TIERS: BrandPresetTier[] = [24, 48, 72, 96, 120, 144, 168, 192, 221, 293];

const MANMAN_CATALOG_TIERS: BrandPresetTier[] = [
  24, 48, 72, 96, 120, 144, 168, 192, 216, 221, 264,
];

const MIXIAOWO_CATALOG_TIERS: BrandPresetTier[] = [
  24, 48, 72, 96, 120, 144, 168, 192, 216, 221, 264,
];

function catalogTiersForBrand(b: BrandId): BrandPresetTier[] {
  if (b === "coco") return COCO_CATALOG_TIERS;
  if (b === "manman") return MANMAN_CATALOG_TIERS;
  if (b === "mixiaowo") return MIXIAOWO_CATALOG_TIERS;
  return MARD_CATALOG_TIERS;
}

export default function PaletteDebugPage() {
  const [brand, setBrand] = useState<BrandId>("coco");
  const [tier, setTier] = useState<BrandPresetTier>(48);

  const colorA1 = getMasterColorById("A1");
  const cocoA1 = getBrandCode("coco", "A1");
  const mard48 = getPreset("mard", 48);
  const inPreset = isColorInPreset("mard", 48, "A1");

  const selectedCatalogTier = getTierCatalogMasterIds(brand, tier);
  const selectedPreset = getPreset(brand, tier);
  const selectedSource = getPresetSource(brand);
  const selectedSubset = isBrandPresetSubsetOfStandardTier(brand, tier);
  const selectedTierHead10 = getTierCatalogHeadIds(brand, tier, 10);
  const selectedTierLooksLikePrefix = isStandardTierLikelyMasterPrefixSlice(tier, brand);
  const groupCounts = useMemo(() => getMappedCountByMasterGroup(brand), [brand]);

  const brandStats = useMemo(
    () =>
      BRAND_OPTIONS.filter((b) => b !== "mard").map((b) => {
        const mapping = BRAND_MAPPINGS[b];
        const values = Object.values(mapping);
        const mapped = values.filter((v) => v !== null).length;
        return { brand: b, mapped, nulls: values.length - mapped };
      }),
    [],
  );

  const tier48Overview = useMemo(
    () =>
      BRAND_OPTIONS.map((b) => ({
        brand: b,
        source: getPresetSource(b),
        count: getPreset(b, 48)?.availableMasterIds.length ?? 0,
        subset: isBrandPresetSubsetOfStandardTier(b, 48),
      })),
    [],
  );

  const standardTierOverview = useMemo(
    () =>
      MARD_CATALOG_TIERS.map((t) => ({
        tier: t,
        count: getStandardTierMasterIds(t).length,
        head10: getStandardTierHeadIds(t, 10),
        looksLikePrefix: isStandardTierLikelyMasterPrefixSlice(t, "mard"),
      })),
    [],
  );

  const nullMappingExample = useMemo(() => {
    const mapping = BRAND_MAPPINGS[brand];
    const nullKey =
      Object.entries(mapping).find(([, mapped]) => mapped === null)?.[0] ?? null;
    return nullKey;
  }, [brand]);

  const mappingForSamples = BRAND_MAPPINGS[brand];

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-lg font-semibold">Palette Debug</h1>
      <p className="text-sm text-slate-600">
        Master total: {getMasterPalette().length} · MARD 标准档 48 主色数:{" "}
        {getStandardTierMasterIds(48).length} · COCO 档 48:{" "}
        {getTierCatalogMasterIds("coco", 48).length}
      </p>

      <section className="rounded-xl bg-slate-50 p-4 text-sm">
        <p>A1 exists: {colorA1 ? "yes" : "no"}</p>
        <p>A1 hex: {colorA1?.hex ?? "-"}</p>
      </section>

      <section className="rounded-xl bg-slate-50 p-4 text-sm">
        <p>COCO mapping A1: {cocoA1 ?? "×"}</p>
      </section>

      <section className="rounded-xl bg-slate-50 p-4 text-sm">
        <p>MARD 48 preset found: {mard48 ? "yes" : "no"}</p>
        <p>A1 in MARD 48: {inPreset ? "yes" : "no"}</p>
      </section>

      <section className="rounded-xl bg-slate-50 p-4 text-sm">
        <h2 className="mb-2 font-medium">Brand Mapping Stats (non-mard)</h2>
        <div className="space-y-1 text-slate-700">
          {brandStats.map((item) => (
            <p key={item.brand}>
              {BRAND_LABELS[item.brand]}: mapped {item.mapped} / null{" "}
              {item.nulls}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-slate-50 p-4 text-sm">
        <h2 className="mb-2 font-medium">MARD 标准档（standard-tiers.json）</h2>
        <div className="space-y-1 font-mono text-xs text-slate-700">
          {standardTierOverview.map((row) => (
            <div key={row.tier}>
              <p>tier {row.tier}: {row.count}</p>
              <p>
                head10: {row.head10.join(", ")} · 疑似顺序切片:{" "}
                {row.looksLikePrefix ? "是" : "否"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-slate-50 p-4 text-sm">
        <h2 className="mb-2 font-medium">Preset · tier 48（全品牌概览）</h2>
        <p className="mb-2 text-xs text-slate-500">
          mard = 标准档原样；盼盼 = 与 MARD 相同的 standard-tiers.json ∩ 盼盼映射（无独立盒装表）。
          COCO／漫漫／咪小窝 = 各品牌盒装 tiers JSON。custom 档位留给 UI 自定义套装，当前数据层未实现。
        </p>
        <div className="space-y-1 font-mono text-xs text-slate-700">
          {tier48Overview.map((row) => (
            <p key={row.brand}>
              {BRAND_LABELS[row.brand]}: source={row.source} · count={row.count}{" "}
              · subsetOfStandard48={row.subset ? "yes" : "no"}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-slate-50 p-4 text-sm">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="font-medium">当前品牌</span>
            <select
              className="rounded border border-slate-200 bg-white px-2 py-1 text-sm"
              value={brand}
              onChange={(e) => {
                const b = e.target.value as BrandId;
                setBrand(b);
                const allowed = catalogTiersForBrand(b);
                if (!allowed.includes(tier)) {
                  setTier(allowed[0] ?? 48);
                }
              }}
            >
              {BRAND_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {BRAND_LABELS[b]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-medium">当前 tier</span>
            <select
              className="rounded border border-slate-200 bg-white px-2 py-1 text-sm"
              value={tier}
              onChange={(e) => setTier(Number(e.target.value) as BrandPresetTier)}
            >
              {catalogTiersForBrand(brand).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 space-y-1 text-slate-700">
          <p>
            Preset 来源: <strong>{selectedSource}</strong>
          </p>
          <p>
            当前品牌 tier {tier} 可用主色数:{" "}
            <strong>{selectedPreset?.availableMasterIds.length ?? 0}</strong> / 档位目录
            {tier} = {selectedCatalogTier.length}
          </p>
          <p>
            当前档位目录 tier {tier} 前 10 个 ID:{" "}
            <strong>{selectedTierHead10.join(", ")}</strong>
          </p>
          <p>
            当前档位目录 tier {tier} 疑似 MARD 顺序切片:{" "}
            <strong>{selectedTierLooksLikePrefix ? "是" : "否"}</strong>
          </p>
          <p>
            是否为档位目录 tier {tier} 子集:{" "}
            <strong>{selectedSubset ? "是" : "否"}</strong>
          </p>
          <p>
            当前品牌 preset source 字段:{" "}
            <strong>{selectedPreset?.source ?? "-"}</strong>
          </p>
        </div>
      </section>

      <section className="rounded-xl bg-slate-50 p-4 text-sm">
        <h2 className="mb-2 font-medium">null mapping 显示示例</h2>
        <p>
          {BRAND_LABELS[brand]} 示例 key:{" "}
          <strong>{nullMappingExample ?? "-"}</strong>
        </p>
        <p>
          映射值显示:{" "}
          <strong>
            {nullMappingExample
              ? BRAND_MAPPINGS[brand][nullMappingExample] ?? "×"
              : "无 null 项"}
          </strong>
        </p>
      </section>

      <section className="rounded-xl bg-slate-50 p-4 text-sm">
        <label className="mb-2 flex items-center gap-2">
          <span className="font-medium">当前品牌</span>
          <select
            className="rounded border border-slate-200 bg-white px-2 py-1 text-sm"
            value={brand}
            onChange={(e) => setBrand(e.target.value as BrandId)}
          >
            {BRAND_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {BRAND_LABELS[b]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="rounded-xl bg-slate-50 p-4 text-sm">
        <h2 className="mb-2 font-medium">
          按组 mapped 数量（{BRAND_LABELS[brand]}）
        </h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-4">
          {MAPPING_GROUP_LETTERS.map((letter) => (
            <p key={letter}>
              {letter}: {groupCounts[letter]}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-slate-50 p-4 text-sm">
        <h2 className="mb-2 font-medium">Sample Keys</h2>
        <div className="space-y-1 text-slate-700">
          {SAMPLE_KEYS.map((key) => (
            <p key={key}>
              {key} | coco={cocoMapping[key] ?? "×"} | manman=
              {manmanMapping[key] ?? "×"} | panpan={panpanMapping[key] ?? "×"}
            </p>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          当前所选品牌样例（mapping）:{" "}
          {SAMPLE_KEYS.map((key) => (
            <span key={key} className="mr-2 inline-block">
              {key}={mappingForSamples[key as keyof typeof cocoMapping] ?? "×"}
            </span>
          ))}
        </p>
      </section>
    </main>
  );
}
