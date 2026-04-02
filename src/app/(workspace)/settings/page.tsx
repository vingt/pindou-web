"use client";

import { useCallback, useMemo, useState } from "react";
import { SettingsBrandsTab } from "@/components/settings/settings-brands-tab";
import { SettingsColorsTab } from "@/components/settings/settings-colors-tab";
import { SettingsPresetsTab } from "@/components/settings/settings-presets-tab";
import { useBrandSettings } from "@/contexts/brand-settings-context";
import type { BrandDefinition } from "@/modules/brand-settings/schema";
import { cn } from "@/lib/cn";

type TabId = "brands" | "colors" | "presets";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "brands", label: "品牌" },
  { id: "colors", label: "颜色" },
  { id: "presets", label: "套装" },
];

export default function SettingsPage() {
  const { bundle, updateBundle, resetToDefault } = useBrandSettings();

  const [tab, setTab] = useState<TabId>("brands");
  const [colorBrandId, setColorBrandId] = useState<string>("mard");
  const [presetBrandId, setPresetBrandId] = useState<string>("mard");

  const brandsSorted = useMemo(
    () => [...bundle.brands].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    [bundle.brands],
  );

  const firstBrandId = brandsSorted[0]?.id ?? "mard";

  const effectiveColorBrandId = useMemo(
    () => (bundle.brands.some((b) => b.id === colorBrandId) ? colorBrandId : firstBrandId),
    [bundle.brands, colorBrandId, firstBrandId],
  );

  const effectivePresetBrandId = useMemo(
    () => (bundle.brands.some((b) => b.id === presetBrandId) ? presetBrandId : firstBrandId),
    [bundle.brands, presetBrandId, firstBrandId],
  );

  const deleteBrand = useCallback(
    (row: BrandDefinition) => {
      if (row.isBuiltIn) return;
      const nc = bundle.colors.filter((c) => c.brandId === row.id).length;
      const np = bundle.presets.filter((p) => p.brandId === row.id).length;
      if (
        !window.confirm(
          `确定删除自定义品牌「${row.displayName}」？\n将同时移除 ${nc} 条颜色与 ${np} 个套装，此操作不可撤销。`,
        )
      ) {
        return;
      }
      updateBundle((prev) => ({
        ...prev,
        brands: prev.brands.filter((b) => b.id !== row.id),
        colors: prev.colors.filter((c) => c.brandId !== row.id),
        presets: prev.presets.filter((p) => p.brandId !== row.id),
      }));
    },
    [bundle.colors, bundle.presets, updateBundle],
  );

  return (
    <div className="mx-auto min-h-0 w-full max-w-7xl px-4 pb-20 pt-8 md:px-8">
      <header className="mb-10 flex flex-col justify-between gap-6 md:mb-12 md:flex-row md:items-end">
        <div className="space-y-3">
          <h1 className="font-[var(--font-manrope)] text-4xl font-black tracking-tight text-loom-on-surface md:text-5xl">
            设置
          </h1>
          <div className="flex w-fit items-center gap-2 rounded-lg bg-loom-surface-low px-4 py-2 text-loom-on-surface-variant ring-1 ring-loom-outline-variant/15">
            <span aria-hidden className="text-sm">
              ◆
            </span>
            <p className="text-sm font-medium">
              所有数据保存在您的本地浏览器中；恢复默认将清空 localStorage 中的品牌相关配置。
            </p>
          </div>
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center gap-2 rounded-full bg-rose-100 px-6 py-3 text-sm font-bold text-rose-900 ring-1 ring-rose-200/80 transition hover:bg-rose-200/90"
          onClick={() => {
            if (
              window.confirm(
                "确定恢复为内置默认？将清除本机已保存的全部品牌/颜色/套装自定义内容（localStorage），并载入内置默认配置。",
              )
            ) {
              resetToDefault();
            }
          }}
        >
          <span aria-hidden>↻</span>
          恢复默认设置
        </button>
      </header>

      <div className="flex flex-col gap-8">
        <div className="flex w-full flex-wrap gap-2 rounded-xl bg-loom-surface-low p-1.5 ring-1 ring-loom-outline-variant/10 md:w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                "rounded-lg px-6 py-3 text-sm font-semibold transition",
                tab === t.id
                  ? "bg-loom-surface-lowest text-loom-primary shadow-sm ring-1 ring-loom-outline-variant/10"
                  : "text-loom-on-surface-variant hover:text-loom-primary",
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-loom-outline-variant/20 bg-loom-surface-lowest p-6 shadow-sm md:p-8">
          {tab === "brands" ? (
        <SettingsBrandsTab
          brandsSorted={brandsSorted}
          updateBundle={updateBundle}
          onDeleteBrand={deleteBrand}
        />
      ) : null}

      {tab === "colors" ? (
        <SettingsColorsTab
          bundle={bundle}
          brandsSorted={brandsSorted}
          colorBrandId={effectiveColorBrandId}
          setColorBrandId={setColorBrandId}
          updateBundle={updateBundle}
        />
      ) : null}

          {tab === "presets" ? (
            <SettingsPresetsTab
              bundle={bundle}
              brandsSorted={brandsSorted}
              presetBrandId={effectivePresetBrandId}
              setPresetBrandId={setPresetBrandId}
              updateBundle={updateBundle}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
