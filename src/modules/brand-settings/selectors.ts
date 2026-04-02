import { getBrandLabel } from "@/data/branding/brand-labels";
import { isTierPresetMasterListComplete } from "@/modules/brand-settings/tier-catalog-size";
import type { BrandDefinition, BrandPresetDefinition } from "./schema";
import { getActiveBrandSettingsBundle } from "./runtime";

export function getEnabledBrandsSorted(bundle = getActiveBrandSettingsBundle()): BrandDefinition[] {
  return bundle.brands
    .filter((b) => b.isEnabled)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function getBrandDefinition(
  brandId: string,
  bundle = getActiveBrandSettingsBundle(),
): BrandDefinition | undefined {
  return bundle.brands.find((b) => b.id === brandId);
}

export function getBrandDisplayName(
  brandId: string,
  bundle = getActiveBrandSettingsBundle(),
): string {
  return getBrandDefinition(brandId, bundle)?.displayName ?? getBrandLabel(brandId);
}

export function isCanonicalMasterBrandId(
  brandId: string,
  bundle = getActiveBrandSettingsBundle(),
): boolean {
  const b = getBrandDefinition(brandId, bundle);
  return Boolean(b?.isCanonical);
}

export function getEnabledPresetsForBrand(
  brandId: string,
  bundle = getActiveBrandSettingsBundle(),
): BrandPresetDefinition[] {
  return bundle.presets
    .filter(
      (p) =>
        p.brandId === brandId &&
        p.isEnabled &&
        isTierPresetMasterListComplete(p.brandId, p.tier, p.masterIds.length),
    )
    .slice()
    .sort((a, b) => {
      if (a.tier === "custom") return 1;
      if (b.tier === "custom") return -1;
      return (a.tier as number) - (b.tier as number);
    });
}

/** Numeric tiers only (excludes custom), sorted ascending. */
export function getEnabledNumericTierPresetsForBrand(
  brandId: string,
  bundle = getActiveBrandSettingsBundle(),
): BrandPresetDefinition[] {
  return getEnabledPresetsForBrand(brandId, bundle).filter((p) => p.tier !== "custom");
}

export function getCustomPresetForBrand(
  brandId: string,
  bundle = getActiveBrandSettingsBundle(),
): BrandPresetDefinition | undefined {
  return bundle.presets.find(
    (p) => p.brandId === brandId && p.tier === "custom" && p.isEnabled,
  );
}

export function findPresetById(
  presetId: string,
  bundle = getActiveBrandSettingsBundle(),
): BrandPresetDefinition | undefined {
  const p = bundle.presets.find((row) => row.id === presetId);
  if (!p) return undefined;
  if (!isTierPresetMasterListComplete(p.brandId, p.tier, p.masterIds.length)) {
    return undefined;
  }
  return p;
}

export function findFirstEnabledPresetForTier(
  brandId: string,
  tier: BrandPresetDefinition["tier"],
  bundle = getActiveBrandSettingsBundle(),
): BrandPresetDefinition | undefined {
  return getEnabledPresetsForBrand(brandId, bundle).find((p) => p.tier === tier);
}
