"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { canDeleteColorRow } from "@/modules/brand-settings/bundle-validation";
import { parseBrandColorsCsv } from "@/modules/brand-settings/import-colors-csv";
import {
  normalizeHex6,
  parseHexToRgb,
  resolveNearestMasterId,
} from "@/modules/brand-settings/resolve-nearest-master";
import type {
  BrandColorDefinition,
  BrandDefinition,
  BrandSettingsBundle,
} from "@/modules/brand-settings/schema";

type Props = {
  bundle: BrandSettingsBundle;
  brandsSorted: BrandDefinition[];
  colorBrandId: string;
  setColorBrandId: (id: string) => void;
  updateBundle: (updater: (prev: BrandSettingsBundle) => BrandSettingsBundle) => void;
};

function hasBrandColorCode(c: BrandColorDefinition): boolean {
  return c.brandCode !== null && String(c.brandCode).trim() !== "";
}

function sortColorsForBrand(list: BrandColorDefinition[]) {
  return [...list].sort((a, b) => {
    const ca = a.brandCode ?? "\uffff";
    const cb = b.brandCode ?? "\uffff";
    if (ca !== cb) return ca.localeCompare(cb, "zh-Hans-CN");
    return a.masterId.localeCompare(b.masterId);
  });
}

export function SettingsColorsTab({
  bundle,
  brandsSorted,
  colorBrandId,
  setColorBrandId,
  updateBundle,
}: Props) {
  const [colorSearch, setColorSearch] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newHex, setNewHex] = useState("#");
  const [newR, setNewR] = useState("");
  const [newG, setNewG] = useState("");
  const [newB, setNewB] = useState("");
  const [csvFeedback, setCsvFeedback] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const colorsForBrand = useMemo(() => {
    const q = colorSearch.trim().toLowerCase();
    return sortColorsForBrand(
      bundle.colors
        .filter((c) => c.brandId === colorBrandId)
        .filter(hasBrandColorCode)
        .filter((c) => {
          if (!q) return true;
          const code = (c.brandCode ?? "").toLowerCase();
          const hx = c.hex.toLowerCase();
          return code.includes(q) || hx.includes(q);
        }),
    );
  }, [bundle.colors, colorBrandId, colorSearch]);

  const applyHexToNewRgb = useCallback(() => {
    const n = normalizeHex6(newHex);
    if (!n) return;
    const rgb = parseHexToRgb(n);
    if (!rgb) return;
    setNewHex(n);
    setNewR(String(rgb.r));
    setNewG(String(rgb.g));
    setNewB(String(rgb.b));
  }, [newHex]);

  const addSingleColor = useCallback(() => {
    const brandCode = newCode.trim();
    if (!brandCode) {
      window.alert("请填写品牌色号。");
      return;
    }
    const hexNorm = normalizeHex6(newHex);
    if (!hexNorm) {
      window.alert("HEX 不合法。");
      return;
    }
    const r = Number.parseInt(newR.trim(), 10);
    const g = Number.parseInt(newG.trim(), 10);
    const b = Number.parseInt(newB.trim(), 10);
    if ([r, g, b].some((x) => !Number.isFinite(x) || x < 0 || x > 255)) {
      window.alert("R/G/B 须为 0–255。");
      return;
    }
    const fromHex = parseHexToRgb(hexNorm);
    if (!fromHex || fromHex.r !== r || fromHex.g !== g || fromHex.b !== b) {
      window.alert("HEX 与 R/G/B 不一致。");
      return;
    }
    const masterId = resolveNearestMasterId(r, g, b);
    if (bundle.colors.some((c) => c.brandId === colorBrandId && c.masterId === masterId)) {
      window.alert("该颜色已映射到系统主色，请编辑现有行或换一组颜色值。");
      return;
    }
    if (
      bundle.colors.some(
        (c) =>
          c.brandId === colorBrandId &&
          c.brandCode !== null &&
          c.brandCode !== "" &&
          c.brandCode.trim() === brandCode,
      )
    ) {
      window.alert("当前品牌下已有相同品牌色号。");
      return;
    }
    const row: BrandColorDefinition = {
      brandId: colorBrandId,
      brandCode,
      hex: hexNorm,
      r,
      g,
      b,
      masterId,
      isEnabled: true,
      isBuiltIn: false,
    };
    updateBundle((prev) => ({ ...prev, colors: [...prev.colors, row] }));
    setNewCode("");
    setNewHex("#");
    setNewR("");
    setNewG("");
    setNewB("");
  }, [newCode, newHex, newR, newG, newB, bundle.colors, colorBrandId, updateBundle]);

  const onCsvFile = useCallback(
    async (file: File) => {
      setCsvFeedback(null);
      let text: string;
      try {
        text = await file.text();
      } catch {
        setCsvFeedback("无法读取文件。");
        return;
      }
      const parsed = parseBrandColorsCsv(text);
      if (parsed.headerError) {
        setCsvFeedback(parsed.headerError);
        return;
      }
      let success = 0;
      let skipped = 0;
      let errors = 0;
      const toAdd: BrandColorDefinition[] = [];
      const seenMaster = new Set(
        bundle.colors.filter((c) => c.brandId === colorBrandId).map((c) => c.masterId),
      );
      const seenCodes = new Set(
        bundle.colors
          .filter((c) => c.brandId === colorBrandId)
          .map((c) => (c.brandCode ?? "").trim())
          .filter(Boolean),
      );

      for (const row of parsed.rows) {
        if (!row.ok) {
          errors += 1;
          continue;
        }
        const masterId = resolveNearestMasterId(row.r, row.g, row.b);
        if (seenMaster.has(masterId)) {
          skipped += 1;
          continue;
        }
        if (seenCodes.has(row.brandCode.trim())) {
          skipped += 1;
          continue;
        }
        seenMaster.add(masterId);
        seenCodes.add(row.brandCode.trim());
        toAdd.push({
          brandId: colorBrandId,
          brandCode: row.brandCode.trim(),
          hex: row.hex,
          r: row.r,
          g: row.g,
          b: row.b,
          masterId,
          isEnabled: true,
          isBuiltIn: false,
        });
        success += 1;
      }

      if (toAdd.length) {
        updateBundle((prev) => ({ ...prev, colors: [...prev.colors, ...toAdd] }));
      }
      setCsvFeedback(
        `导入完成：成功 ${success} 条，跳过 ${skipped} 条，错误 ${errors} 条。`,
      );
    },
    [bundle.colors, colorBrandId, updateBundle],
  );

  return (
    <section className="mt-0 space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">颜色</h2>
      <p className="text-xs text-slate-500">
        当前品牌视角管理颜色；仅列出已填写品牌色号的行（无色号的主色不在此表展示）。新增与导入会按颜色值自动关联到系统主色（内部使用，不在此页展示）。
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">当前品牌</span>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={colorBrandId}
            onChange={(e) => setColorBrandId(e.target.value)}
          >
            {brandsSorted.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">搜索</span>
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={colorSearch}
            onChange={(e) => setColorSearch(e.target.value)}
            placeholder="品牌色号 / HEX"
          />
        </label>
      </div>

      <div className="rounded-xl bg-slate-50/80 p-4 ring-1 ring-slate-200">
        <p className="text-xs font-medium text-slate-700">新增一条颜色</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">
            品牌色号
            <input
              className="mt-0.5 block w-28 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            HEX
            <input
              className="mt-0.5 block w-28 rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-sm"
              value={newHex}
              onChange={(e) => setNewHex(e.target.value)}
              onBlur={applyHexToNewRgb}
            />
          </label>
          <label className="text-xs text-slate-600">
            R
            <input
              className="mt-0.5 block w-14 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={newR}
              onChange={(e) => setNewR(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            G
            <input
              className="mt-0.5 block w-14 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={newG}
              onChange={(e) => setNewG(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            B
            <input
              className="mt-0.5 block w-14 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              value={newB}
              onChange={(e) => setNewB(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={addSingleColor}
          >
            添加
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200"
          onClick={() => csvRef.current?.click()}
        >
          从 CSV 导入当前品牌…
        </button>
        <input
          ref={csvRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onCsvFile(f);
          }}
        />
        <span className="text-xs text-slate-500">
          表头：品牌色号,HEX,R,G,B（须与展示列一致）
        </span>
      </div>
      {csvFeedback ? (
        <p className="text-sm text-slate-700">{csvFeedback}</p>
      ) : null}

      <p className="text-sm font-medium text-slate-800">
        共 <span className="tabular-nums text-indigo-700">{colorsForBrand.length}</span>{" "}
        色
        {colorSearch.trim() ? (
          <span className="ml-2 font-normal text-slate-500">（当前筛选结果）</span>
        ) : null}
      </p>

      <div className="max-h-[min(70vh,560px)] overflow-auto rounded-xl ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs font-medium text-slate-600">
            <tr>
              <th className="px-3 py-2">品牌色号</th>
              <th className="px-3 py-2">色块</th>
              <th className="px-3 py-2">HEX</th>
              <th className="px-3 py-2">R</th>
              <th className="px-3 py-2">G</th>
              <th className="px-3 py-2">B</th>
              <th className="px-3 py-2">启用</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {colorsForBrand.map((c) => (
              <tr key={`${c.brandId}-${c.masterId}`}>
                <td className="px-3 py-2 font-mono text-xs">{c.brandCode}</td>
                <td className="px-3 py-2">
                  <span
                    className="inline-block h-6 w-10 rounded ring-1 ring-slate-200"
                    style={{ backgroundColor: c.hex }}
                    aria-hidden
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs">{c.hex}</td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums">{c.r}</td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums">{c.g}</td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums">{c.b}</td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={c.isEnabled}
                    onChange={(e) =>
                      updateBundle((prev) => ({
                        ...prev,
                        colors: prev.colors.map((x) =>
                          x.brandId === c.brandId && x.masterId === c.masterId
                            ? { ...x, isEnabled: e.target.checked }
                            : x,
                        ),
                      }))
                    }
                    aria-label="启用"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  {canDeleteColorRow(c, bundle) ? (
                    <button
                      type="button"
                      className="text-xs text-rose-600 hover:underline"
                      onClick={() =>
                        updateBundle((prev) => ({
                          ...prev,
                          colors: prev.colors.filter(
                            (x) => !(x.brandId === c.brandId && x.masterId === c.masterId),
                          ),
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
