"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { isCanonicalMasterBrandId } from "@/modules/brand-settings/selectors";
import type { BrandId } from "@/types";
import type { ColorUsageStat } from "@/types/export";

/** 品牌色号优先；与 master 相同时只显示一个，否则「品牌色 · 主色」。 */
export function formatBrandMasterDisplayLabel(
  brand: BrandId,
  masterId: string,
  getBrandCode: (b: BrandId, id: string) => string | null,
): string {
  if (isCanonicalMasterBrandId(brand)) return masterId;
  const code = getBrandCode(brand, masterId);
  if (code === null) return `× · ${masterId}`;
  if (code === masterId) return code;
  return `${code} · ${masterId}`;
}

/** 编辑器 / 下拉等 UI：只显示当前品牌色号（不并列 MARD 主色号）。MARD 模式下即主键 id。 */
export function formatBrandOnlyDisplayLabel(
  brand: BrandId,
  masterId: string,
  getBrandCode: (b: BrandId, id: string) => string | null,
): string {
  if (isCanonicalMasterBrandId(brand)) return masterId;
  return getBrandCode(brand, masterId) ?? "×";
}

type ColorSwatchSelectProps = {
  brand: BrandId;
  items: ColorUsageStat[];
  value: string | null;
  onChange: (masterId: string | null) => void;
  placeholder: string;
  getBrandCode: (b: BrandId, id: string) => string | null;
  disabled?: boolean;
};

export function ColorSwatchSelect({
  brand,
  items,
  value,
  onChange,
  placeholder,
  getBrandCode,
  disabled,
}: ColorSwatchSelectProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = value ? items.find((i) => i.masterId === value) : undefined;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const labelFor = (masterId: string) =>
    formatBrandMasterDisplayLabel(brand, masterId, getBrandCode);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled || items.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-left text-xs text-slate-700 ring-1 ring-slate-200 transition",
          disabled || items.length === 0
            ? "cursor-not-allowed opacity-60"
            : "hover:bg-slate-50",
        )}
        onClick={() => {
          if (!disabled && items.length > 0) setOpen((o) => !o);
        }}
      >
        {selected ? (
          <>
            <span
              className="h-5 w-5 shrink-0 rounded ring-1 ring-slate-200"
              style={{ backgroundColor: selected.hex }}
              aria-hidden
            />
            <span className="min-w-0 truncate font-mono">{labelFor(selected.masterId)}</span>
          </>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <span className="ml-auto text-slate-400" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200"
        >
          {items.map((item) => {
            const active = item.masterId === value;
            return (
              <li key={item.masterId} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition",
                    active ? "bg-indigo-50 text-indigo-900" : "text-slate-700 hover:bg-slate-50",
                  )}
                  onClick={() => {
                    onChange(item.masterId);
                    setOpen(false);
                  }}
                >
                  <span
                    className="h-5 w-5 shrink-0 rounded ring-1 ring-slate-200"
                    style={{ backgroundColor: item.hex }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 font-mono">{labelFor(item.masterId)}</span>
                  <span className="shrink-0 text-[10px] text-slate-400">{item.count} 颗</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
