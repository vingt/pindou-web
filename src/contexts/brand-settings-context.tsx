"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BrandSettingsBundleSchema,
  type BrandSettingsBundle,
} from "@/modules/brand-settings/schema";
import {
  getDefaultBrandSettingsBundle,
  setActiveBrandSettingsBundle,
} from "@/modules/brand-settings/runtime";
import {
  loadSettings,
  resetSettingsToDefault,
  saveSettings,
} from "@/modules/brand-settings/storage";

type BrandSettingsContextValue = {
  bundle: BrandSettingsBundle;
  setBundle: (next: BrandSettingsBundle) => void;
  updateBundle: (updater: (prev: BrandSettingsBundle) => BrandSettingsBundle) => void;
  resetToDefault: () => void;
  version: number;
};

const BrandSettingsContext = createContext<BrandSettingsContextValue | null>(null);

export function BrandSettingsProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundleState] = useState<BrandSettingsBundle>(() =>
    getDefaultBrandSettingsBundle(),
  );
  const [version, setVersion] = useState(0);
  const skipNextPersist = useRef(true);

  useLayoutEffect(() => {
    const loaded = loadSettings();
    if (loaded) {
      setBundleState(loaded);
    }
    skipNextPersist.current = true;
  }, []);

  useLayoutEffect(() => {
    setActiveBrandSettingsBundle(bundle);
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    saveSettings(bundle);
  }, [bundle]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const setBundle = useCallback(
    (next: BrandSettingsBundle) => {
      const parsed = BrandSettingsBundleSchema.safeParse(next);
      if (!parsed.success) return;
      setBundleState(parsed.data);
      bump();
    },
    [bump],
  );

  const updateBundle = useCallback(
    (updater: (prev: BrandSettingsBundle) => BrandSettingsBundle) => {
      setBundleState((prev) => {
        const next = updater(prev);
        const parsed = BrandSettingsBundleSchema.safeParse(next);
        return parsed.success ? parsed.data : prev;
      });
      bump();
    },
    [bump],
  );

  const resetToDefault = useCallback(() => {
    const fresh = resetSettingsToDefault();
    setBundleState(fresh);
    setActiveBrandSettingsBundle(fresh);
    bump();
  }, [bump]);

  const value = useMemo<BrandSettingsContextValue>(
    () => ({
      bundle,
      setBundle,
      updateBundle,
      resetToDefault,
      version,
    }),
    [bundle, setBundle, updateBundle, resetToDefault, version],
  );

  return (
    <BrandSettingsContext.Provider value={value}>{children}</BrandSettingsContext.Provider>
  );
}

export function useBrandSettings() {
  const ctx = useContext(BrandSettingsContext);
  if (!ctx) {
    throw new Error("useBrandSettings must be used within BrandSettingsProvider");
  }
  return ctx;
}

export function useBrandSettingsOptional() {
  return useContext(BrandSettingsContext);
}
