import { getBrandLabel } from "@/data/branding/brand-labels";
import { BRAND_IDS } from "@/modules/palette/schemas/palette-data-schema";

/** Built-in ids only; UI should prefer settings-driven `getEnabledBrandsSorted`. */
export const STATIC_BRAND_OPTIONS: Array<{ id: string; label: string }> = BRAND_IDS.map(
  (id) => ({
    id,
    label: getBrandLabel(id),
  }),
);
