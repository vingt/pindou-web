import { getAlternativeBrandIdsOrdered } from "@/modules/brand-settings/alternatives-order";
import { getBrandDisplayName, isCanonicalMasterBrandId } from "@/modules/brand-settings/selectors";
import { getBrandCode } from "@/modules/palette/services";
import type { BrandId } from "@/types";

function partForBrand(brandId: string, masterId: string): string {
  const label = getBrandDisplayName(brandId);
  if (isCanonicalMasterBrandId(brandId)) {
    return `${label} ${masterId}`;
  }
  const code = getBrandCode(brandId, masterId);
  return `${label} ${code ?? "×"}`;
}

/** 与其它品牌替代展示一致：canonical（主色号）优先，其余品牌色号或 ×。 */
export function formatAlternativesLine(masterId: string, currentBrand: BrandId): string {
  return getAlternativeBrandIdsOrdered(currentBrand).map((b) => partForBrand(b, masterId)).join(" / ");
}
