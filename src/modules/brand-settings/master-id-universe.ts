import mardMapping from "@/data/mappings/mard.mapping.json";

/**
 * 映射层主色键全集（与内置 mard.mapping 键一致），用于校验 masterId 是否属于系统可识别的主色键。
 */
const KEYS = Object.keys(mardMapping as Record<string, unknown>);

export const KNOWN_MASTER_ID_SET = new Set(KEYS);

export function isKnownMasterColorId(masterId: string): boolean {
  return KNOWN_MASTER_ID_SET.has(masterId);
}
