import { buildDefaultBrandSettingsBundle } from "./default-bundle";
import type { BrandSettingsBundle } from "./schema";

const DEFAULT = buildDefaultBrandSettingsBundle();

let activeBundle: BrandSettingsBundle = DEFAULT;

export function getDefaultBrandSettingsBundle(): BrandSettingsBundle {
  return structuredClone(DEFAULT);
}

export function getActiveBrandSettingsBundle(): BrandSettingsBundle {
  return activeBundle;
}

export function setActiveBrandSettingsBundle(bundle: BrandSettingsBundle): void {
  activeBundle = bundle;
}

export function resetRuntimeBrandSettingsToDefault(): void {
  activeBundle = buildDefaultBrandSettingsBundle();
}
