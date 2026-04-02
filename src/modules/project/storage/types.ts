import type { BrandId, PresetTier } from "@/types";
import type { PatternProject } from "@/types";

/** Index row for recent list UI (no full cells payload). */
export type PatternProjectListEntry = {
  id: string;
  name: string;
  updatedAt: string;
  brand: BrandId;
  tier: PresetTier;
  width: number | null;
  height: number | null;
};

/**
 * Pluggable persistence — IndexedDB in production path; swap for tests or future sync.
 */
export type ProjectStorageAdapter = {
  put(project: PatternProject): Promise<void>;
  get(id: string): Promise<PatternProject | null>;
  remove(id: string): Promise<void>;
  listRecent(limit?: number): Promise<PatternProjectListEntry[]>;
};
