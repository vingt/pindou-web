import { getActiveBrandSettingsBundle } from "./runtime";
import { getEnabledBrandsSorted } from "./selectors";

/**
 * Other enabled brands for missing-color alternatives: canonical (MARD) first, then sortOrder.
 */
export function getAlternativeBrandIdsOrdered(
  currentBrand: string,
  bundle = getActiveBrandSettingsBundle(),
): string[] {
  const enabled = getEnabledBrandsSorted(bundle).map((b) => b.id);
  const withoutCurrent = enabled.filter((id) => id !== currentBrand);
  const canonical = withoutCurrent.find((id) => {
    const def = bundle.brands.find((b) => b.id === id);
    return def?.isCanonical;
  });
  const rest = withoutCurrent.filter((id) => id !== canonical);
  return canonical ? [canonical, ...rest] : rest;
}
