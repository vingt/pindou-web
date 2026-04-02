/** Legacy built-in display names; prefer `getBrandDisplayName` from brand settings. */
export const BRAND_LABELS: Record<string, string> = {
  mard: "MARD",
  coco: "COCO",
  manman: "漫漫",
  panpan: "盼盼",
  mixiaowo: "咪小窝",
};

export function getBrandLabel(brand: string): string {
  return BRAND_LABELS[brand] ?? brand;
}
