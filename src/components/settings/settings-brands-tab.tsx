"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import { generateBrandIdFromDisplayName } from "@/modules/brand-settings/generate-brand-id";
import type { BrandDefinition, BrandSettingsBundle } from "@/modules/brand-settings/schema";

type Props = {
  brandsSorted: BrandDefinition[];
  updateBundle: (updater: (prev: BrandSettingsBundle) => BrandSettingsBundle) => void;
  onDeleteBrand: (row: BrandDefinition) => void;
};

function nextSortOrder(brands: BrandDefinition[]) {
  const max = brands.reduce((m, b) => Math.max(m, b.sortOrder), -1);
  return max + 1;
}

export function SettingsBrandsTab({
  brandsSorted,
  updateBundle,
  onDeleteBrand,
}: Props) {
  const [newBrandName, setNewBrandName] = useState("");

  const onAddClick = useCallback(() => {
    const displayName = newBrandName.trim();
    if (!displayName) {
      window.alert("请填写品牌名称。");
      return;
    }
    let duplicate = false;
    updateBundle((prev) => {
      if (prev.brands.some((b) => b.displayName.trim() === displayName)) {
        duplicate = true;
        return prev;
      }
      const existingIds = new Set(prev.brands.map((b) => b.id));
      const id = generateBrandIdFromDisplayName(displayName, existingIds);
      const brand: BrandDefinition = {
        id,
        displayName,
        isBuiltIn: false,
        isEnabled: true,
        sortOrder: nextSortOrder(prev.brands),
        isCanonical: false,
      };
      return { ...prev, brands: [...prev.brands, brand] };
    });
    if (duplicate) {
      window.alert("已有同名品牌。");
      return;
    }
    setNewBrandName("");
  }, [newBrandName, updateBundle]);

  const reorderBrands = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      updateBundle((prev) => {
        const order = [...brandsSorted].map((b) => b.id);
        const from = order.indexOf(sourceId);
        const to = order.indexOf(targetId);
        if (from < 0 || to < 0) return prev;
        const nextOrder = [...order];
        nextOrder.splice(from, 1);
        nextOrder.splice(to, 0, sourceId);
        const byId = new Map(prev.brands.map((b) => [b.id, b]));
        const brands = nextOrder.map((id, i) => {
          const b = byId.get(id)!;
          return { ...b, sortOrder: i };
        });
        return { ...prev, brands };
      });
    },
    [brandsSorted, updateBundle],
  );

  return (
    <section className="mt-0 space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">品牌</h2>
      <div className="rounded-xl bg-slate-50/80 p-4 ring-1 ring-slate-200">
        <p className="text-xs text-slate-600">新增品牌只需填写名称，系统将自动生成内部标识。</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">
            品牌名称
            <input
              className="mt-0.5 block min-w-[12rem] rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              placeholder="例如：我的品牌"
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={onAddClick}
          >
            添加
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium text-slate-600">
            <tr>
              <th className="w-10 px-2 py-2" aria-label="排序" />
              <th className="px-3 py-2">品牌名称</th>
              <th className="px-3 py-2">启用</th>
              <th className="px-3 py-2">类型</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {brandsSorted.map((b) => (
              <tr
                key={b.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", b.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const sourceId = e.dataTransfer.getData("text/plain");
                  reorderBrands(sourceId, b.id);
                }}
                className="hover:bg-slate-50/80"
              >
                <td className="cursor-grab px-2 py-2 text-slate-400 select-none" title="拖动排序">
                  ⋮⋮
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full min-w-[8rem] rounded border border-slate-200 px-2 py-1 text-sm"
                    value={b.displayName}
                    onChange={(e) =>
                      updateBundle((prev) => ({
                        ...prev,
                        brands: prev.brands.map((x) =>
                          x.id === b.id ? { ...x, displayName: e.target.value } : x,
                        ),
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={b.isEnabled}
                    onChange={(e) =>
                      updateBundle((prev) => ({
                        ...prev,
                        brands: prev.brands.map((x) =>
                          x.id === b.id ? { ...x, isEnabled: e.target.checked } : x,
                        ),
                      }))
                    }
                    aria-label={`启用 ${b.displayName}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      b.isBuiltIn
                        ? "bg-amber-100 text-amber-900"
                        : "bg-slate-200 text-slate-800",
                    )}
                  >
                    {b.isBuiltIn ? "内置" : "自定义"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {b.isBuiltIn ? (
                    <span className="text-[11px] text-slate-400">—</span>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-rose-600 hover:underline"
                      onClick={() => onDeleteBrand(b)}
                    >
                      删除
                    </button>
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
