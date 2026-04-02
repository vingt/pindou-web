import { buildDefaultBrandSettingsBundle } from "./default-bundle";
import { BrandSettingsBundleSchema, type BrandSettingsBundle } from "./schema";

const STORAGE_KEY = "brand-settings-bundle:v1";

/**
 * 读取本地已保存的设置；校验失败或不存在时返回 `null`（应用应回退到默认 bundle）。
 */
export function loadSettings(): BrandSettingsBundle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    const parsed = BrandSettingsBundleSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** 将当前 bundle 写入 localStorage（MVP）。 */
export function saveSettings(bundle: BrandSettingsBundle): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
  } catch {
    /* ignore quota */
  }
}

/**
 * 清除本地持久化并返回一份新的内置默认 bundle（由调用方写入 React state / runtime）。
 */
export function resetSettingsToDefault(): BrandSettingsBundle {
  clearStoredSettings();
  return buildDefaultBrandSettingsBundle();
}

export function clearStoredSettings(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated 使用 `loadSettings` */
export const loadBrandSettingsFromStorage = loadSettings;

/** @deprecated 使用 `saveSettings` */
export const saveBrandSettingsToStorage = saveSettings;

/** @deprecated 使用 `clearStoredSettings` */
export const clearBrandSettingsStorage = clearStoredSettings;
