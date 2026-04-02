"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { cn } from "@/lib/cn";
import { getBrandDisplayName, isCanonicalMasterBrandId } from "@/modules/brand-settings/selectors";
import { downloadBlob } from "@/modules/export/download-blob";
import { buildCustomPaletteExportCsv } from "@/modules/export/csv-export-lists";
import {
  PALETTE_CSV_IMPORT_TEMPLATE,
  parsePaletteCsvMasterIds,
} from "@/modules/palette/services/palette-csv";
import {
  getBrandCode,
  getBrandFullPurchasableMasterIds,
  getMasterColorById,
} from "@/modules/palette/services";
import type { BrandId } from "@/types";

type CustomPaletteDrawerProps = {
  open: boolean;
  onClose: () => void;
  brand: BrandId;
  initialSelection: string[];
  onApply: (masterIds: string[]) => void;
};

function matchesSearch(id: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const qu = q.toUpperCase();
  if (id.toUpperCase().includes(qu)) return true;
  const m = getMasterColorById(id);
  if (!m) return false;
  const hexNorm = m.hex.toUpperCase().replace("#", "");
  const qHex = qu.replace(/^#/, "");
  if (hexNorm.includes(qHex) || qHex.length >= 3 && hexNorm.startsWith(qHex)) return true;
  return false;
}

function tileLabel(brand: BrandId, masterId: string): string {
  if (isCanonicalMasterBrandId(brand)) return masterId;
  return getBrandCode(brand, masterId) ?? masterId;
}

function labelColorForHex(hex: string): string {
  if (hex.length < 7 || hex[0] !== "#") return "#0f172a";
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

export function CustomPaletteDrawer({
  open,
  onClose,
  brand,
  initialSelection,
  onApply,
}: CustomPaletteDrawerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const selectable = useMemo(
    () => getBrandFullPurchasableMasterIds(brand).sort((a, b) => a.localeCompare(b)),
    [brand],
  );

  /** 按主数据 group（A/B/C…）分组 */
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const id of selectable) {
      const m = getMasterColorById(id);
      const key = m?.group && m.group.length > 0 ? m.group : (id.match(/^([A-Z]+)/)?.[1] ?? "?");
      const list = map.get(key) ?? [];
      list.push(id);
      map.set(key, list);
    }
    for (const [, ids] of map) {
      ids.sort((a, b) => a.localeCompare(b));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [selectable]);

  const groupsFiltered = useMemo(() => {
    return groups
      .map(([letter, ids]) => ({
        letter,
        ids: ids.filter((id) => matchesSearch(id, search)),
        total: ids.length,
      }))
      .filter((g) => g.ids.length > 0);
  }, [groups, search]);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reset drawer local state when opened */
    setDraft(new Set(initialSelection));
    setSearch("");
    setErr(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initialSelection]);

  const toggle = useCallback((id: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllInBrand = () => setDraft(new Set(selectable));
  const deselectAll = () => setDraft(new Set());

  const restoreDefault = () => setDraft(new Set(selectable));

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    try {
      const text = await file.text();
      const parsed = parsePaletteCsvMasterIds(text);
      if (!parsed.ok) {
        setErr(parsed.error);
        return;
      }
      const selectableSet = new Set(selectable);
      const ok = parsed.ids.filter((id) => selectableSet.has(id));
      if (ok.length === 0) {
        setErr("CSV 中的色号均不在当前品牌可选范围内");
        return;
      }
      setDraft(new Set(ok));
    } catch {
      setErr("无法读取文件");
    }
  };

  const handleApply = () => {
    const ids = [...draft].sort((a, b) => a.localeCompare(b));
    if (ids.length === 0) {
      setErr("请至少选择一种颜色");
      return;
    }
    onApply(ids);
    onClose();
  };

  if (!open) return null;

  const brandLabel = getBrandDisplayName(brand);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-stone-900/45 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-palette-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="关闭" onClick={onClose} />
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-hidden
        onChange={(ev) => void handleImport(ev)}
      />
      <div className="relative z-10 flex max-h-[min(88vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-stone-200/80">
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-3 pr-3">
          <div className="min-w-0">
            <h2 id="custom-palette-title" className="text-base font-semibold text-stone-900">
              自定义色板
            </h2>
            <p className="mt-0.5 text-[11px] leading-snug text-stone-500">
              {brandLabel} · 严格套装仅使用已选主色；CSV 色号列为 MARD 主色编号。
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            aria-label="关闭"
            onClick={onClose}
          >
            <span className="block text-lg leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>

        <div className="border-b border-stone-50 px-4 py-3">
          <input
            type="search"
            placeholder="搜索色号或 HEX…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-stone-50/90 px-3 py-2.5 text-sm text-stone-900 outline-none ring-stone-300 placeholder:text-stone-400 focus:ring-2"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <button
                type="button"
                className="font-medium text-stone-800 underline-offset-2 hover:underline"
                onClick={selectAllInBrand}
              >
                全选
              </button>
              <button
                type="button"
                className="font-medium text-stone-800 underline-offset-2 hover:underline"
                onClick={deselectAll}
              >
                全不选
              </button>
            </div>
            <p className="text-sm tabular-nums text-stone-600">
              已选 <strong className="text-stone-900">{draft.size}</strong> / {selectable.length}
            </p>
          </div>
        </div>

        {err ? <p className="px-4 py-2 text-xs text-rose-600">{err}</p> : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {groupsFiltered.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">无匹配色号</p>
          ) : (
            <div className="space-y-6">
              {groupsFiltered.map(({ letter, ids, total }) => (
                <section key={letter}>
                  <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-stone-100 pb-1">
                    <h3 className="text-sm font-semibold text-stone-800">{letter} 色系</h3>
                    <span className="text-[11px] text-stone-500">
                      {search.trim() ? `${ids.length} / ${total} 色` : `${total} 色`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ids.map((id) => {
                      const m = getMasterColorById(id);
                      const hex = m?.hex ?? "#e7e5e4";
                      const on = draft.has(id);
                      const label = tileLabel(brand, id);
                      const tc = labelColorForHex(hex);
                      return (
                        <button
                          key={id}
                          type="button"
                          title={`${id}${m ? ` · ${m.hex}` : ""}`}
                          aria-pressed={on}
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold leading-tight transition sm:h-12 sm:w-12 sm:text-[11px]",
                            on
                              ? "ring-2 ring-stone-900 ring-offset-2 ring-offset-white"
                              : "ring-1 ring-stone-200/90 hover:ring-stone-400",
                          )}
                          style={{
                            backgroundColor: hex,
                            color: tc,
                            textShadow:
                              tc === "#ffffff"
                                ? "0 0 2px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.35)"
                                : "0 0 1px rgba(255,255,255,0.4)",
                          }}
                          onClick={() => toggle(id)}
                        >
                          <span className="max-w-[2.75rem] truncate px-0.5 text-center">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-stone-50 px-3 py-2 text-xs font-medium text-stone-800 ring-1 ring-stone-200 hover:bg-white"
              onClick={() => fileRef.current?.click()}
            >
              导入色板
            </button>
            <button
              type="button"
              className="px-2 py-2 text-xs font-medium text-stone-700 underline-offset-2 hover:underline"
              onClick={() => {
                const csv = buildCustomPaletteExportCsv([...draft].sort((a, b) => a.localeCompare(b)));
                downloadBlob(
                  new Blob([csv], { type: "text/csv;charset=utf-8" }),
                  `palette-${brand}-custom.csv`,
                );
              }}
            >
              导出 CSV
            </button>
            <button
              type="button"
              className="px-2 py-2 text-xs font-medium text-stone-700 underline-offset-2 hover:underline"
              onClick={() => {
                downloadBlob(
                  new Blob([PALETTE_CSV_IMPORT_TEMPLATE], { type: "text/csv;charset=utf-8" }),
                  "palette-import-template.csv",
                );
              }}
            >
              下载导入模版
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="px-3 py-2 text-xs font-medium text-stone-600 underline-offset-2 hover:underline"
              onClick={restoreDefault}
            >
              恢复默认
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-xs font-medium text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800"
              onClick={handleApply}
            >
              应用（{draft.size} 色）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
