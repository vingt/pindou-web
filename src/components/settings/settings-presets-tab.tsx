"use client";

import { useCallback, useMemo, useState } from "react";
import { canDeletePresetRow } from "@/modules/brand-settings/bundle-validation";
import {
  getTierCatalogSizeForBrand,
  isTierPresetMasterListComplete,
} from "@/modules/brand-settings/tier-catalog-size";
import type {
  BrandDefinition,
  BrandPresetDefinition,
  BrandSettingsBundle,
} from "@/modules/brand-settings/schema";

type Props = {
  bundle: BrandSettingsBundle;
  brandsSorted: BrandDefinition[];
  presetBrandId: string;
  setPresetBrandId: (id: string) => void;
  updateBundle: (updater: (prev: BrandSettingsBundle) => BrandSettingsBundle) => void;
};

function tierLabel(t: BrandPresetDefinition["tier"]): string {
  return t === "custom" ? "自定义" : String(t);
}

function hasBrandColorCode(c: BrandSettingsBundle["colors"][number]): boolean {
  return c.brandCode !== null && String(c.brandCode).trim() !== "";
}

function sortBrandColors(
  colors: BrandSettingsBundle["colors"],
  brandId: string,
) {
  return colors
    .filter((c) => c.brandId === brandId)
    .filter(hasBrandColorCode)
    .slice()
    .sort((a, b) => {
      const ca = a.brandCode ?? "\uffff";
      const cb = b.brandCode ?? "\uffff";
      if (ca !== cb) return ca.localeCompare(cb, "zh-Hans-CN");
      return a.masterId.localeCompare(b.masterId);
    });
}

export function SettingsPresetsTab({
  bundle,
  brandsSorted,
  presetBrandId,
  setPresetBrandId,
  updateBundle,
}: Props) {
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetTier, setNewPresetTier] = useState<BrandPresetDefinition["tier"]>(24);

  const presetTierOptions = useMemo((): Array<BrandPresetDefinition["tier"]> => {
    if (presetBrandId === "coco") {
      return [24, 48, 72, 96, 120, 144, 168, 192, 221, 293, "custom"];
    }
    if (presetBrandId === "manman") {
      return [24, 48, 72, 96, 120, 144, 168, 192, 216, 221, 264, "custom"];
    }
    if (presetBrandId === "mixiaowo") {
      return [24, 48, 72, 96, 120, 144, 168, 192, 216, 221, 264, "custom"];
    }
    return [24, 48, 72, 96, 120, 144, 216, 221, 264, "custom"];
  }, [presetBrandId]);

  const effectiveNewPresetTier = useMemo((): BrandPresetDefinition["tier"] => {
    if (newPresetTier === "custom") return "custom";
    if (presetTierOptions.includes(newPresetTier)) return newPresetTier;
    return (presetTierOptions.find((t) => t !== "custom") ?? 24) as BrandPresetDefinition["tier"];
  }, [newPresetTier, presetTierOptions]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [selectedMasterIds, setSelectedMasterIds] = useState<Set<string>>(() => new Set());

  const brandColorsSorted = useMemo(
    () => sortBrandColors(bundle.colors, presetBrandId),
    [bundle.colors, presetBrandId],
  );

  const pickerFiltered = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return brandColorsSorted;
    return brandColorsSorted.filter((c) => {
      const code = (c.brandCode ?? "").toLowerCase();
      const hx = c.hex.toLowerCase();
      return code.includes(q) || hx.includes(q);
    });
  }, [brandColorsSorted, pickerSearch]);

  const presetsForBrand = useMemo(
    () =>
      bundle.presets
        .filter((p) => p.brandId === presetBrandId)
        .filter((p) =>
          isTierPresetMasterListComplete(p.brandId, p.tier, p.masterIds.length),
        )
        .slice()
        .sort((a, b) => {
          if (a.tier === "custom") return 1;
          if (b.tier === "custom") return -1;
          return (a.tier as number) - (b.tier as number);
        }),
    [bundle.presets, presetBrandId],
  );

  const colorByMaster = useMemo(() => {
    const m = new Map<string, (typeof bundle.colors)[number]>();
    for (const c of bundle.colors) {
      if (c.brandId === presetBrandId) {
        m.set(c.masterId, c);
      }
    }
    return m;
  }, [bundle, presetBrandId]);

  const toggleMaster = useCallback((masterId: string) => {
    setSelectedMasterIds((prev) => {
      const next = new Set(prev);
      if (next.has(masterId)) next.delete(masterId);
      else next.add(masterId);
      return next;
    });
  }, []);

  const addCustomPreset = useCallback(() => {
    const displayName = newPresetName.trim();
    if (!displayName) {
      window.alert("请填写套装名称。");
      return;
    }
    const ordered = brandColorsSorted
      .filter((c) => selectedMasterIds.has(c.masterId))
      .map((c) => c.masterId);
    const masterIds = [...new Set(ordered)];
    if (effectiveNewPresetTier !== "custom" && masterIds.length === 0) {
      window.alert("请至少选择一种颜色。");
      return;
    }
    const id = `user_${presetBrandId}_${effectiveNewPresetTier}_${Date.now()}`;
    updateBundle((prev) => {
      if (prev.presets.some((p) => p.id === id)) return prev;
      return {
        ...prev,
        presets: [
          ...prev.presets,
          {
            id,
            brandId: presetBrandId,
            displayName,
            tier: effectiveNewPresetTier,
            masterIds,
            isBuiltIn: false,
            isEnabled: true,
          },
        ],
      };
    });
    setNewPresetName("");
    setSelectedMasterIds(new Set());
    setPickerSearch("");
  }, [
    newPresetName,
    effectiveNewPresetTier,
    presetBrandId,
    brandColorsSorted,
    selectedMasterIds,
    updateBundle,
  ]);

  return (
    <section className="mt-0 space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">套装</h2>
      <p className="text-xs text-slate-500">
        在当前品牌下管理套装；颜色从本品牌颜色列表勾选（仅含已填品牌色号）。标准档位若映射颜色数少于该档目录要求，套装不会出现在此表及编辑器中，直至映射补全。
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">当前品牌</span>
        <select
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          value={presetBrandId}
          onChange={(e) => {
            setPresetBrandId(e.target.value);
            setSelectedMasterIds(new Set());
            setPickerSearch("");
          }}
        >
          {brandsSorted.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-xl bg-slate-50/80 p-4 ring-1 ring-slate-200">
        <p className="text-xs font-medium text-slate-700">新增套装</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">
            套装名称
            <input
              className="mt-0.5 block min-w-[8rem] rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            档位
            <select
              className="mt-0.5 block rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={String(effectiveNewPresetTier)}
              onChange={(e) => {
                const v = e.target.value;
                setNewPresetTier(
                  v === "custom" ? "custom" : (Number(v) as BrandPresetDefinition["tier"]),
                );
              }}
            >
              {presetTierOptions.map((t) => (
                <option key={String(t)} value={String(t)}>
                  {tierLabel(t)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-600">从当前品牌颜色中选择（可搜索）</p>
        <input
          className="mt-1 w-full max-w-md rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
          value={pickerSearch}
          onChange={(e) => setPickerSearch(e.target.value)}
          placeholder="品牌色号 / HEX"
        />
        <div className="mt-2 max-h-48 overflow-auto rounded border border-slate-200 bg-white p-2">
          <ul className="grid gap-1 sm:grid-cols-2">
            {pickerFiltered.map((c) => {
              const checked = selectedMasterIds.has(c.masterId);
              const label = c.brandCode ?? "";
              return (
                <li key={c.masterId}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMaster(c.masterId)}
                    />
                    <span
                      className="inline-block h-5 w-8 shrink-0 rounded ring-1 ring-slate-200"
                      style={{ backgroundColor: c.hex }}
                      aria-hidden
                    />
                    <span className="truncate font-mono text-xs">{label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="mt-2 text-xs text-slate-500">已选 {selectedMasterIds.size} 色</p>
        <button
          type="button"
          className="mt-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          onClick={addCustomPreset}
        >
          添加套装
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium text-slate-600">
            <tr>
              <th className="px-3 py-2">套装名称</th>
              <th className="px-3 py-2">档位</th>
              <th className="px-3 py-2">颜色数量</th>
              <th className="px-3 py-2">类型</th>
              <th className="px-3 py-2">启用</th>
              <th className="min-w-[12rem] px-3 py-2">套装颜色预览</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {presetsForBrand.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={7}>
                  当前品牌无可用套装（标准档需颜色数与目录一致；可新增自定义套装）。
                </td>
              </tr>
            ) : null}
            {presetsForBrand.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2">{p.displayName}</td>
                <td className="px-3 py-2">{tierLabel(p.tier)}</td>
                <td className="px-3 py-2 tabular-nums">
                  <span className="font-medium">{p.masterIds.length}</span>
                  {p.tier !== "custom" ? (
                    <span className="text-slate-400">
                      {" "}
                      / {getTierCatalogSizeForBrand(p.brandId, p.tier) ?? "—"}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      p.isBuiltIn
                        ? "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900"
                        : "rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-800"
                    }
                  >
                    {p.isBuiltIn ? "内置" : "自定义"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={p.isEnabled}
                    onChange={(e) =>
                      updateBundle((prev) => ({
                        ...prev,
                        presets: prev.presets.map((x) =>
                          x.id === p.id ? { ...x, isEnabled: e.target.checked } : x,
                        ),
                      }))
                    }
                    aria-label="启用"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex max-w-md flex-wrap gap-1.5">
                    {p.masterIds.length === 0 ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      p.masterIds.map((mid) => {
                        const row = colorByMaster.get(mid);
                        const hx = row?.hex ?? "#e2e8f0";
                        const code =
                          row?.brandCode === null || row?.brandCode === ""
                            ? "×"
                            : (row?.brandCode ?? "×");
                        return (
                          <span
                            key={mid}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 ring-1 ring-slate-200"
                            title={code}
                          >
                            <span
                              className="inline-block h-4 w-5 shrink-0 rounded-sm ring-1 ring-slate-200"
                              style={{ backgroundColor: hx }}
                              aria-hidden
                            />
                            <span className="max-w-[4.5rem] truncate font-mono text-[10px]">
                              {code}
                            </span>
                          </span>
                        );
                      })
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  {canDeletePresetRow(p) ? (
                    <button
                      type="button"
                      className="text-xs text-rose-600 hover:underline"
                      onClick={() =>
                        updateBundle((prev) => ({
                          ...prev,
                          presets: prev.presets.filter((x) => x.id !== p.id),
                        }))
                      }
                    >
                      删除
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
