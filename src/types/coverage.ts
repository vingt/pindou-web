import type { BrandId } from "./palette";

export type BrandAvailability = {
  brand: BrandId;
  masterId: string;
  brandCode: string | null;
  available: boolean;
};

export type PresetCoverage = {
  presetId: string;
  brand: BrandId;
  totalUsedColors: number;
  coveredColors: number;
  missingColors: number;
  coveredBeads: number;
  missingBeads: number;
};
