import type { BrandSettingsBundle } from "./schema";

function colorKey(c: { brandId: string; masterId: string }) {
  return `${c.brandId}\0${c.masterId}`;
}

/** Incoming entries win on id / composite key. */
export function mergeBrandSettingsBundles(
  base: BrandSettingsBundle,
  incoming: BrandSettingsBundle,
): BrandSettingsBundle {
  const brandById = new Map(base.brands.map((b) => [b.id, { ...b }]));
  for (const b of incoming.brands) {
    brandById.set(b.id, { ...b });
  }

  const colorByKey = new Map(base.colors.map((c) => [colorKey(c), { ...c }]));
  for (const c of incoming.colors) {
    colorByKey.set(colorKey(c), { ...c });
  }

  const presetById = new Map(base.presets.map((p) => [p.id, { ...p }]));
  for (const p of incoming.presets) {
    presetById.set(p.id, { ...p });
  }

  return {
    schemaVersion: incoming.schemaVersion,
    brands: [...brandById.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    colors: [...colorByKey.values()],
    presets: [...presetById.values()],
  };
}
