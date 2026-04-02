"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import { getBrandDisplayName } from "@/modules/brand-settings/selectors";
import { runFixedComparisonCandidates } from "@/modules/pattern/services/run-fixed-comparison";
import { saveUserOptimizationPreference } from "@/modules/project/persist-user-optimization";
import { useProjectStore } from "@/modules/project/store";
import type { ComparisonCandidate, PatternCell } from "@/types";

function cloneCells(cells: PatternCell[][]): PatternCell[][] {
  return cells.map((row) => row.map((cell) => ({ ...cell })));
}
import { PatternThumbnail } from "@/components/pattern-thumbnail";

type SchemeComparisonDrawerProps = {
  open: boolean;
  onClose: () => void;
  onApplied: (message: string) => void;
};

export function SchemeComparisonDrawer({
  open,
  onClose,
  onApplied,
}: SchemeComparisonDrawerProps) {
  const [candidates, setCandidates] = useState<ComparisonCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCompare = useCallback(async () => {
    const s = useProjectStore.getState();
    if (!s.sourceImageFile || !s.sourceImageWidth || !s.sourceImageHeight) {
      setError("请先上传图片");
      setCandidates(null);
      return;
    }
    setError(null);
    setBusy(true);
    setCandidates(null);
    try {
      const list = await runFixedComparisonCandidates({
        image: s.sourceImageFile,
        imageWidth: s.sourceImageWidth,
        imageHeight: s.sourceImageHeight,
        brand: s.selectedBrand,
        tier: s.selectedTier,
        presetId: s.selectedPresetId,
        generationMode: s.selectedGenerationMode,
        compareOriginal: false,
        targetGridWidth: s.targetGridWidth,
        targetGridHeight: s.targetGridHeight,
        customPaletteMasterIds: s.customPaletteMasterIds,
      });
      setCandidates(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "比较生成失败");
    } finally {
      setBusy(false);
    }
  }, []);

  const applyCandidate = useCallback(
    (c: ComparisonCandidate) => {
      saveUserOptimizationPreference(c.config.optimization);
      useProjectStore.setState({
        lastGeneratedConfig: c.config,
        generationResult: c.result,
        missingColorAnalysis: c.missingColorAnalysis,
        optimization: c.config.optimization,
        targetGridWidth: c.config.targetGridWidth,
        targetGridHeight: c.config.targetGridHeight,
        selectedMasterColorId: c.result.usedMasterIds[0] ?? null,
        historyStack: [],
        redoStack: [],
        baselineCells: cloneCells(c.result.cells),
        selectedTier: c.config.tier,
        selectedPresetId: c.config.presetId,
        customPaletteMasterIds:
          c.config.tier === "custom" ? (c.config.customPaletteMasterIds ?? []) : [],
      });
      onApplied(`已应用「${c.title}」`);
      onClose();
      setCandidates(null);
    },
    [onApplied, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scheme-compare-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="关闭比较"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2
              id="scheme-compare-title"
              className="font-[var(--font-manrope)] text-lg font-semibold text-slate-900"
            >
              方案比较
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              基于当前图片、品牌、档位与生成模式，生成三条固定管线结果并排对比；应用后同步高级生成参数与缺色分析，无需再点「生成图纸」。
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-50 px-5 py-3">
          <button
            type="button"
            disabled={busy}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium text-white transition",
              busy ? "cursor-wait bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-500",
            )}
            onClick={() => void runCompare()}
          >
            {busy ? "生成比较中…" : "一键比较"}
          </button>
          {error ? <span className="text-xs text-rose-600">{error}</span> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!candidates?.length ? (
            <p className="text-sm text-slate-500">
              {busy
                ? "正在依次生成三个方案，请稍候…"
                : "点击「一键比较」生成三个候选方案。"}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {candidates.map((c) => {
                const brand = c.config.brand;
                return (
                  <div
                    key={c.id}
                    className="flex flex-col rounded-xl bg-slate-50/90 p-4 ring-1 ring-slate-100"
                  >
                    <div className="flex justify-center">
                      <PatternThumbnail result={c.result} brand={brand} maxWidthPx={132} />
                    </div>
                    <h3 className="mt-3 text-center font-[var(--font-manrope)] text-sm font-semibold text-slate-800">
                      {c.title}
                    </h3>
                    <p className="mt-1 text-center text-[11px] text-slate-500">
                      {getBrandDisplayName(brand)}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-700">
                      <li className="flex justify-between gap-2">
                        <span className="text-slate-500">画布</span>
                        <span className="font-medium tabular-nums">
                          {c.summary.width}×{c.summary.height}
                        </span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span className="text-slate-500">使用色数</span>
                        <span className="font-medium tabular-nums">
                          {c.summary.usedColorCount}
                        </span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span className="text-slate-500">总豆数</span>
                        <span className="font-medium tabular-nums">
                          {c.summary.totalBeads}
                        </span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span className="text-slate-500">缺色数</span>
                        <span className="font-medium tabular-nums">
                          {c.summary.missingColorCount}
                        </span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span className="text-slate-500">覆盖率</span>
                        <span className="font-medium tabular-nums">
                          {(c.summary.coverageRate * 100).toFixed(1)}%
                        </span>
                      </li>
                    </ul>
                    <button
                      type="button"
                      className="mt-4 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
                      onClick={() => applyCandidate(c)}
                    >
                      应用此方案
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
