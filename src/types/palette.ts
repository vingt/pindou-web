/**
 * Master color entity from the unique MARD 221 mother palette.
 */
export type MasterColor = {
  masterColorId: string;
  displayName: string;
  hex: string;
  index: number;
};

/** Brand id from settings (`^[a-z][a-z0-9_]*$`); includes built-ins and user-defined. */
export type BrandId = string;

/**
 * Mapping item between one brand color and a master color.
 * null means this brand color has no available mapped target.
 */
export type BrandMapping = {
  brandId: BrandId;
  brandColorId: string;
  masterColorId: string | null;
};

/**
 * User selectable brand tier (set size).
 */
export type PresetTier =
  | 24
  | 48
  | 72
  | 96
  | 120
  | 144
  | 168
  | 192
  | 216
  | 221
  | 264
  | 293
  | "custom";

/**
 * Stable UI preset identifiers.
 */
export type PresetId = "mard221" | "custom";

export type BrandPresetTier = Exclude<PresetTier, "custom">;
export type StandardTierLevel = BrandPresetTier;
export type StandardTier = Record<`${StandardTierLevel}`, string[]>;

/** Preset id from settings (e.g. `mard_48`, `mybrand_custom_abc`). */
export type BrandPresetId = string;

/**
 * Preset is represented by available master color ids.
 */
export type BrandPreset = {
  presetId: BrandPresetId;
  brand: BrandId;
  tier: PresetTier;
  source: "standard-tier" | "brand-specific" | "custom";
  availableMasterIds: string[];
};
