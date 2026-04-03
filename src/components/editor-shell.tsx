"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ColorSwatchSelect,
  formatBrandMasterDisplayLabel,
} from "@/components/color-swatch-select";
import { CustomPaletteDrawer } from "@/components/custom-palette-drawer";
import { SchemeComparisonDrawer } from "@/components/scheme-comparison-drawer";
import { useBrandSettings } from "@/contexts/brand-settings-context";
import { cn } from "@/lib/cn";
import {
  getBrandDisplayName,
  getCustomPresetForBrand,
  getEnabledBrandsSorted,
  getEnabledPresetsForBrand,
  isCanonicalMasterBrandId,
} from "@/modules/brand-settings/selectors";
import { formatAlternativesLine } from "@/modules/export/alternatives-line";
import { saveProject } from "@/modules/project/project-service";
import { useProjectStore } from "@/modules/project/store";
import { getBrandCode, getMasterColorById } from "@/modules/palette/services";
import {
  buildColorUsageStats,
  buildColorUsageStatsCsv,
  buildExportPatternPayload,
  buildMissingColorsCsv,
  buildPatternExportBasename,
  downloadBlob,
  exportPatternPdf,
  exportPatternPng,
} from "@/modules/export";
import { analyzeMissingColors } from "@/modules/pattern/services/analyze-missing-colors";
import { generatePattern } from "@/modules/pattern/services/generate-pattern";
import { rebuildGenerationResultWithCells } from "@/modules/pattern/services/rebuild-generation-result";
import { loadUserOptimizationPreference } from "@/modules/project/persist-user-optimization";
import { normalizeGenerationConfig } from "@/types/project";
import type {
  BrandId,
  DitheringMode,
  GenerationConfig,
  MissingColorAnalysis,
  PatternCell,
  GenerationMode,
  PatternGenerationResult,
  PresetTier,
  ProcessingMode,
} from "@/types";

const GENERATION_OPTIONS: Array<{ value: GenerationMode; label: string }> = [
  { value: "strict-preset", label: "严格套装" },
  { value: "allow-refill", label: "允许补色" },
];

const PROCESSING_MODE_OPTIONS: Array<{
  value: ProcessingMode;
  label: string;
  hint: string;
}> = [
  { value: "standard", label: "标准", hint: "均衡，无抖动、不合并、不清理孤立点" },
  {
    value: "detail",
    label: "细节优先",
    hint: "Floyd–Steinberg 抖动，保留更多层次",
  },
  {
    value: "easy",
    label: "易做优先",
    hint: "合并极少用量色并清理单格噪点，适合实作",
  },
  {
    value: "poster",
    label: "海报 / 插画风",
    hint: "Atkinson 抖动 + 更强合并与孤立点清理，块面感更明显",
  },
];

const DITHERING_OPTIONS: Array<{ value: DitheringMode; label: string }> = [
  { value: "none", label: "关闭" },
  { value: "floyd-steinberg", label: "Floyd–Steinberg" },
  { value: "atkinson", label: "Atkinson" },
  { value: "bayer", label: "Bayer（有序抖动）" },
];

function missingColorPrimaryTitle(
  brand: BrandId,
  masterId: string,
  brandCode: string | null,
) {
  const label = getBrandDisplayName(brand);
  const primary = isCanonicalMasterBrandId(brand) ? masterId : (brandCode ?? "×");
  return `${label}：${primary}`;
}

function formatMasterOptionLabel(brand: BrandId, masterId: string): string {
  return formatBrandMasterDisplayLabel(brand, masterId, getBrandCode);
}

const EMPTY_CELL_BG_STYLE: CSSProperties = {
  backgroundColor: "#fafafa",
  backgroundImage:
    "repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 3px, #e2e8f0 3px, #e2e8f0 6px)",
};

const TOOL_OPTIONS = [
  { value: "select", label: "选择", hint: undefined as string | undefined },
  { value: "brush", label: "画笔", hint: undefined },
  { value: "eraser", label: "橡皮擦", hint: "按住拖动可连续擦除" },
  { value: "repair", label: "修复", hint: "用周围最常见的颜色修补当前格子" },
  { value: "eyedropper", label: "吸色器", hint: undefined },
] as const;

function cloneCells(cells: PatternCell[][]): PatternCell[][] {
  return cells.map((row) => row.map((cell) => ({ ...cell })));
}

function cellsDeepEqual(a: PatternCell[][], b: PatternCell[][]): boolean {
  if (a.length !== b.length) return false;
  for (let y = 0; y < a.length; y += 1) {
    if (a[y].length !== b[y].length) return false;
    for (let x = 0; x < a[y].length; x += 1) {
      if (a[y][x].masterColorId !== b[y][x].masterColorId) return false;
    }
  }
  return true;
}

function cellTooltipLabel(brand: BrandId, masterId: string, hex: string): string {
  const line = formatMasterOptionLabel(brand, masterId);
  return hex ? `${line} · ${hex}` : line;
}

/** 画布/导出格内简短色号（当前品牌优先）。 */
function cellEditorDisplayCode(brand: BrandId, masterId: string): string {
  if (isCanonicalMasterBrandId(brand)) return masterId;
  return getBrandCode(brand, masterId) ?? "×";
}

function labelTextColorForHex(hex: string): string {
  if (hex.length < 7 || hex[0] !== "#") return "#0f172a";
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

/** 与 schema / store 一致：8–500 珠；输入过程中用字符串草稿避免「先打 5 再补 0」被立刻夹成 8。 */
const TARGET_GRID_BEAD_MIN = 8;
const TARGET_GRID_BEAD_MAX = 500;

function digitsOnlyGridDraft(raw: string): string {
  return raw.replace(/\D/g, "");
}

function clampTargetGridBeadCount(n: number): number {
  const i = Math.floor(n);
  return Math.max(TARGET_GRID_BEAD_MIN, Math.min(TARGET_GRID_BEAD_MAX, i));
}

export function EditorShell() {
  const {
    selectedBrand,
    selectedPresetId,
    selectedGenerationMode,
    selectedTier,
    sourceImageFile,
    sourceImageUrl,
    sourceImageWidth,
    sourceImageHeight,
    generationResult,
    missingColorAnalysis,
    zoom,
    activeTool,
    selectedMasterColorId,
    historyStack,
    redoStack,
    baselineCells,
    customPaletteMasterIds,
    setCustomPaletteMasterIds,
    setSelectedBrand,
    setSelectedGenerationMode,
    setSelectedTier,
    applyPresetSelection,
    setSourceImage,
    currentProjectName,
    setCurrentProjectName,
    targetGridWidth,
    targetGridHeight,
    setTargetGridWidth,
    setTargetGridHeight,
    setEditedGenerationResult,
    setMissingColorAnalysis,
    setZoom,
    setActiveTool,
    immersiveAssembly,
    immersiveFocusMasterId,
    setImmersiveAssembly,
    setImmersiveFocusMasterId,
    setSelectedMasterColorId,
    pushHistorySnapshot,
    pushRedoSnapshot,
    popUndoSnapshot,
    popRedoSnapshot,
    lastGeneratedConfig,
    optimization,
    setOptimization,
    applyProcessingModePreset,
    resetOptimizationToStandard,
  } = useProjectStore();

  const { bundle } = useBrandSettings();
  const enabledBrands = useMemo(() => getEnabledBrandsSorted(bundle), [bundle]);
  const tierPresets = useMemo(
    () =>
      getEnabledPresetsForBrand(selectedBrand, bundle).filter((p) => p.tier !== "custom"),
    [bundle, selectedBrand],
  );
  const customPreset = useMemo(
    () => getCustomPresetForBrand(selectedBrand, bundle),
    [bundle, selectedBrand],
  );

  useEffect(() => {
    const ids = enabledBrands.map((b) => b.id);
    if (ids.length === 0) return;
    if (!ids.includes(selectedBrand)) {
      setSelectedBrand(ids[0]);
    }
  }, [enabledBrands, selectedBrand, setSelectedBrand]);

  useEffect(() => {
    if ((activeTool as string) === "replace-color") {
      setActiveTool("brush");
    }
  }, [activeTool, setActiveTool]);

  const eraserSessionRef = useRef<{
    before: PatternCell[][] | null;
    draft: PatternCell[][] | null;
  }>({ before: null, draft: null });
  /** 触摸画笔/滴管/修复：略拖则视为滚动画布，松手才落笔，避免与滚动抢手势。 */
  const touchEditPendingRef = useRef<{
    kind: "brush" | "eyedropper" | "repair";
    cx: number;
    cy: number;
    sx: number;
    sy: number;
    cancelled: boolean;
  } | null>(null);
  const [eraserDisplayTick, setEraserDisplayTick] = useState(0);
  const [editorToast, setEditorToast] = useState<string | null>(null);
  const [schemeCompareOpen, setSchemeCompareOpen] = useState(false);
  const [customPaletteOpen, setCustomPaletteOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [hoverGridCell, setHoverGridCell] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [replaceJustDone, setReplaceJustDone] = useState(false);
  const [replaceSourceMasterId, setReplaceSourceMasterId] = useState<string | null>(
    null,
  );
  const [replaceTargetMasterId, setReplaceTargetMasterId] = useState<string | null>(
    null,
  );
  useEffect(() => {
    const saved = loadUserOptimizationPreference();
    if (saved) {
      useProjectStore.setState({ optimization: saved });
    }
  }, []);

  const [generateError, setGenerateError] = useState<string | null>(null);
  const [patternGenerationBusy, setPatternGenerationBusy] = useState(false);
  const autoRegenGeneration = useRef(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const sourceImageInputRef = useRef<HTMLInputElement>(null);

  const [targetGridWidthDraft, setTargetGridWidthDraft] = useState(() =>
    String(targetGridWidth),
  );
  const [targetGridHeightDraft, setTargetGridHeightDraft] = useState(() =>
    String(targetGridHeight),
  );

  useEffect(() => {
    setTargetGridWidthDraft(String(targetGridWidth));
  }, [targetGridWidth]);

  useEffect(() => {
    setTargetGridHeightDraft(String(targetGridHeight));
  }, [targetGridHeight]);

  const commitTargetGridWidthDraft = useCallback(() => {
    const parsed = parseInt(targetGridWidthDraft, 10);
    if (!Number.isFinite(parsed)) {
      setTargetGridWidthDraft(String(targetGridWidth));
      return;
    }
    const next = clampTargetGridBeadCount(parsed);
    setTargetGridWidth(next);
    setTargetGridWidthDraft(String(next));
  }, [targetGridWidthDraft, targetGridWidth, setTargetGridWidth]);

  const commitTargetGridHeightDraft = useCallback(() => {
    const parsed = parseInt(targetGridHeightDraft, 10);
    if (!Number.isFinite(parsed)) {
      setTargetGridHeightDraft(String(targetGridHeight));
      return;
    }
    const next = clampTargetGridBeadCount(parsed);
    setTargetGridHeight(next);
    setTargetGridHeightDraft(String(next));
  }, [targetGridHeightDraft, targetGridHeight, setTargetGridHeight]);

  const immersiveGridMeasureRef = useRef<HTMLDivElement>(null);
  const immersiveStageRef = useRef<HTMLElement>(null);
  const [immersiveFitBasePx, setImmersiveFitBasePx] = useState(12);
  const [fullscreenCapable, setFullscreenCapable] = useState(false);
  const [fullscreenElementActive, setFullscreenElementActive] = useState(false);

  useEffect(() => {
    setFullscreenCapable(
      typeof document !== "undefined" &&
        typeof document.documentElement.requestFullscreen === "function",
    );
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreenElementActive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useLayoutEffect(() => {
    if (!immersiveAssembly || !generationResult) return;
    const el = immersiveGridMeasureRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const gw = generationResult.width;
    const gh = generationResult.height;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const reserveX = 28;
      const reserveCaption = 56;
      const reserveFooter = 44;
      const capW = Math.max(0, w - reserveX);
      const capH = Math.max(0, h - reserveCaption - reserveFooter);
      if (capW <= 0 || capH <= 0) return;
      const fit = Math.min(capW / gw, capH / gh);
      setImmersiveFitBasePx(Math.max(6, Math.min(128, Math.floor(fit))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [immersiveAssembly, generationResult]);

  const immersiveCellPx = useMemo(() => {
    if (!immersiveAssembly) return 12 * zoom;
    return Math.max(6, Math.min(128, Math.round(immersiveFitBasePx * zoom)));
  }, [immersiveAssembly, immersiveFitBasePx, zoom]);

  const effectiveGenerationConfig = useMemo((): GenerationConfig | null => {
    if (!generationResult) return null;
    return (
      lastGeneratedConfig ??
      normalizeGenerationConfig({
        brand: selectedBrand,
        tier: selectedTier,
        presetId: selectedPresetId,
        generationMode: selectedGenerationMode,
        compareOriginal: false,
        targetGridWidth,
        targetGridHeight,
        optimization,
        customPaletteMasterIds,
      })
    );
  }, [
    generationResult,
    lastGeneratedConfig,
    selectedBrand,
    selectedTier,
    selectedPresetId,
    selectedGenerationMode,
    targetGridWidth,
    targetGridHeight,
    optimization,
    customPaletteMasterIds,
  ]);

  const strictCustomBlocked =
    selectedGenerationMode === "strict-preset" &&
    selectedTier === "custom" &&
    customPaletteMasterIds.length === 0;

  const canExport = Boolean(generationResult);
  const colorUsageStats = useMemo(() => {
    if (!generationResult) return [];
    return buildColorUsageStats(generationResult, selectedBrand);
  }, [generationResult, selectedBrand]);

  const replaceMatchCount = useMemo(() => {
    if (!generationResult || !replaceSourceMasterId) return 0;
    let n = 0;
    for (const row of generationResult.cells) {
      for (const cell of row) {
        if (cell.masterColorId === replaceSourceMasterId) n += 1;
      }
    }
    return n;
  }, [generationResult, replaceSourceMasterId]);

  const inventoryHint = useMemo(() => {
    if (!missingColorAnalysis || missingColorAnalysis.status === "fully-covered") {
      return null;
    }
    const items = missingColorAnalysis.missingItems;
    if (!items.length) return null;
    const it = items[0]!;
    const alt = formatAlternativesLine(it.masterId, selectedBrand);
    const code =
      getBrandCode(selectedBrand, it.masterId) ??
      (isCanonicalMasterBrandId(selectedBrand) ? it.masterId : "×");
    return alt
      ? `注意：相对当前套装，部分颜色可能不足或缺货。例如「${code}」可参考替代：${alt}。`
      : `注意：相对当前套装，部分颜色可能不足。请查看「缺色分析」了解「${code}」等色号详情。`;
  }, [missingColorAnalysis, selectedBrand]);

  const immersiveColorIndex = useMemo(() => {
    if (!immersiveFocusMasterId) return -1;
    return colorUsageStats.findIndex((s) => s.masterId === immersiveFocusMasterId);
  }, [colorUsageStats, immersiveFocusMasterId]);

  const immersivePrevColor = useCallback(() => {
    if (colorUsageStats.length === 0) return;
    const idx =
      immersiveColorIndex <= 0 ? colorUsageStats.length - 1 : immersiveColorIndex - 1;
    const id = colorUsageStats[idx]!.masterId;
    setImmersiveFocusMasterId(id);
    setSelectedMasterColorId(id);
  }, [colorUsageStats, immersiveColorIndex, setSelectedMasterColorId]);

  const immersiveNextColor = useCallback(() => {
    if (colorUsageStats.length === 0) return;
    const idx =
      immersiveColorIndex < 0 ? 0 : (immersiveColorIndex + 1) % colorUsageStats.length;
    const id = colorUsageStats[idx]!.masterId;
    setImmersiveFocusMasterId(id);
    setSelectedMasterColorId(id);
  }, [colorUsageStats, immersiveColorIndex, setSelectedMasterColorId]);

  const exitImmersiveAssembly = useCallback(() => {
    if (typeof document !== "undefined" && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    setImmersiveAssembly(false);
  }, [setImmersiveAssembly]);

  const toggleImmersiveFullscreen = useCallback(() => {
    const el = immersiveStageRef.current;
    if (!el || !fullscreenCapable) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  }, [fullscreenCapable]);

  const enterImmersiveAssembly = useCallback(() => {
    if (!generationResult || colorUsageStats.length === 0) return;
    const first = colorUsageStats[0]!.masterId;
    setImmersiveFocusMasterId(first);
    setSelectedMasterColorId(first);
    setActiveTool("brush");
    setImmersiveAssembly(true);
  }, [
    colorUsageStats,
    generationResult,
    setActiveTool,
    setImmersiveAssembly,
    setImmersiveFocusMasterId,
    setSelectedMasterColorId,
  ]);

  useEffect(() => {
    if (!immersiveAssembly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        exitImmersiveAssembly();
        return;
      }
      if (e.key === "ArrowLeft" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        immersivePrevColor();
      }
      if (e.key === "ArrowRight" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        immersiveNextColor();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [immersiveAssembly, exitImmersiveAssembly, immersiveNextColor, immersivePrevColor]);

  const applyEditedCells = (
    nextCells: PatternCell[][],
    options?: { trackHistory?: boolean; historyBeforeCells?: PatternCell[][] },
  ) => {
    const store = useProjectStore.getState();
    const gr = store.generationResult;
    if (!gr) return;
    const trackHistory = options?.trackHistory ?? true;
    if (trackHistory) {
      const snap = options?.historyBeforeCells ?? gr.cells;
      store.pushHistorySnapshot(snap);
      store.clearRedoStack();
    }
    const rebuiltResult = rebuildGenerationResultWithCells({
      base: gr,
      cells: nextCells,
    });
    const nextAnalysis = analyzeMissingColors({
      generationResult: rebuiltResult,
      brand: store.selectedBrand,
      tier: store.selectedTier,
      presetId: store.selectedPresetId,
      generationMode: store.selectedGenerationMode,
      customPaletteMasterIds: store.customPaletteMasterIds,
    });
    store.setEditedGenerationResult(rebuiltResult);
    store.setMissingColorAnalysis(nextAnalysis);
  };

  const endEraserDragSession = () => {
    const s = eraserSessionRef.current;
    eraserSessionRef.current = { before: null, draft: null };
    setEraserDisplayTick((t) => t + 1);
    if (!s.before || !s.draft) return;
    if (!cellsDeepEqual(s.before, s.draft)) {
      applyEditedCells(s.draft, { historyBeforeCells: s.before });
    }
  };

  const eraseCellInDraft = (x: number, y: number) => {
    const draft = eraserSessionRef.current.draft;
    if (!draft) return;
    const cell = draft[y]?.[x];
    if (!cell || cell.masterColorId === null) return;
    draft[y][x] = { ...cell, masterColorId: null };
    setEraserDisplayTick((t) => t + 1);
  };

  const getRepairFallbackColor = (cells: PatternCell[][], x: number, y: number) => {
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    const counts = new Map<string, number>();
    for (const [dx, dy] of dirs) {
      const nextX = x + dx;
      const nextY = y + dy;
      const neighbor = cells[nextY]?.[nextX];
      if (!neighbor || neighbor.masterColorId === null) continue;
      const id = neighbor.masterColorId;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    let bestId: string | null = null;
    let bestCount = -1;
    for (const [masterId, count] of counts) {
      if (count > bestCount) {
        bestId = masterId;
        bestCount = count;
      }
    }
    return bestId ?? selectedMasterColorId ?? cells[y][x].masterColorId;
  };

  const handleCellPointerDown = (x: number, y: number, event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    const gr = useProjectStore.getState().generationResult;
    if (!gr) return;
    const current = gr.cells[y]?.[x];
    if (!current) return;
    if (activeTool === "select") return;

    const attachTouchEditGesture = (
      kind: "brush" | "eyedropper" | "repair",
      onCommit: () => void,
    ) => {
      if (event.pointerType !== "touch") {
        onCommit();
        return;
      }
      touchEditPendingRef.current = {
        kind,
        cx: x,
        cy: y,
        sx: event.clientX,
        sy: event.clientY,
        cancelled: false,
      };
      const onMove = (ev: globalThis.PointerEvent) => {
        const p = touchEditPendingRef.current;
        if (!p || p.kind !== kind) return;
        if (Math.hypot(ev.clientX - p.sx, ev.clientY - p.sy) > 14) {
          p.cancelled = true;
        }
      };
      const end = () => {
        const p = touchEditPendingRef.current;
        touchEditPendingRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        if (!p || p.kind !== kind || p.cancelled) return;
        onCommit();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    };

    if (activeTool === "eyedropper") {
      attachTouchEditGesture("eyedropper", () => {
        setSelectedMasterColorId(current.masterColorId);
      });
      return;
    }
    if (activeTool === "eraser") {
      const hadSession = Boolean(eraserSessionRef.current.before);
      if (!hadSession) {
        eraserSessionRef.current.before = cloneCells(gr.cells);
        eraserSessionRef.current.draft = cloneCells(gr.cells);
        const onUp = () => {
          window.removeEventListener("pointerup", onUp);
          endEraserDragSession();
        };
        window.addEventListener("pointerup", onUp);
      }
      eraseCellInDraft(x, y);
      return;
    }
    if (activeTool === "brush") {
      if (!selectedMasterColorId || selectedMasterColorId === current.masterColorId) return;
      attachTouchEditGesture("brush", () => {
        const latest = useProjectStore.getState().generationResult;
        if (!latest) return;
        const cur = latest.cells[y]?.[x];
        if (!cur || !selectedMasterColorId || selectedMasterColorId === cur.masterColorId) return;
        const nextCells = cloneCells(latest.cells);
        nextCells[y][x] = { ...nextCells[y][x], masterColorId: selectedMasterColorId };
        applyEditedCells(nextCells);
      });
      return;
    }
    if (activeTool === "repair") {
      const nextMasterColorId = getRepairFallbackColor(gr.cells, x, y);
      if (nextMasterColorId === current.masterColorId) return;
      attachTouchEditGesture("repair", () => {
        const latest = useProjectStore.getState().generationResult;
        if (!latest) return;
        const cur = latest.cells[y]?.[x];
        if (!cur) return;
        const nid = getRepairFallbackColor(latest.cells, x, y);
        if (nid === cur.masterColorId) return;
        const nextCells = cloneCells(latest.cells);
        nextCells[y][x] = { ...nextCells[y][x], masterColorId: nid };
        applyEditedCells(nextCells);
      });
    }
  };

  const handleCellPointerEnter = (x: number, y: number, event: ReactPointerEvent) => {
    if (activeTool !== "eraser") return;
    if ((event.buttons & 1) === 0) return;
    if (!eraserSessionRef.current.draft) return;
    eraseCellInDraft(x, y);
  };

  const handleApplyReplaceColor = () => {
    if (!generationResult || !replaceSourceMasterId || !replaceTargetMasterId) return;
    if (replaceSourceMasterId === replaceTargetMasterId) return;
    const nextCells = cloneCells(generationResult.cells);
    let replaced = 0;
    for (let y = 0; y < nextCells.length; y += 1) {
      for (let x = 0; x < nextCells[y].length; x += 1) {
        if (nextCells[y][x].masterColorId === replaceSourceMasterId) {
          nextCells[y][x] = { ...nextCells[y][x], masterColorId: replaceTargetMasterId };
          replaced += 1;
        }
      }
    }
    if (replaced === 0) return;
    applyEditedCells(nextCells);
    setSelectedMasterColorId(replaceTargetMasterId);
    const msg = `已替换 ${replaced} 颗`;
    setEditorToast(msg);
    window.setTimeout(() => setEditorToast(null), 2600);
    setReplaceJustDone(true);
    window.setTimeout(() => setReplaceJustDone(false), 1800);
  };

  const handleUndo = () => {
    if (!generationResult) return;
    const previous = popUndoSnapshot();
    if (!previous) return;
    pushRedoSnapshot(generationResult.cells);
    applyEditedCells(previous, { trackHistory: false });
  };

  const handleRedo = () => {
    if (!generationResult) return;
    const next = popRedoSnapshot();
    if (!next) return;
    pushHistorySnapshot(generationResult.cells);
    applyEditedCells(next, { trackHistory: false });
  };

  const buildExportPayload = () => {
    if (!generationResult || !effectiveGenerationConfig) return null;
    return buildExportPatternPayload({
      generationConfig: effectiveGenerationConfig,
      generationResult,
      missingColorAnalysis,
      sourceImage:
        sourceImageWidth && sourceImageHeight
          ? {
              width: sourceImageWidth,
              height: sourceImageHeight,
              fileName: sourceImageFile?.name ?? null,
            }
          : null,
    });
  };

  const handleExportPng = async () => {
    const payload = buildExportPayload();
    if (!payload) return;
    setExportError(null);
    try {
      const blob = await exportPatternPng(payload);
      const base = buildPatternExportBasename(
        payload.generationConfig.brand,
        payload.generationConfig.tier,
        payload.generationResult.width,
        payload.generationResult.height,
      );
      downloadBlob(blob, `${base}.png`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "PNG 导出失败");
    }
  };

  const handleExportPdf = async () => {
    const payload = buildExportPayload();
    if (!payload) return;
    setExportError(null);
    try {
      const blob = await exportPatternPdf(payload);
      const base = buildPatternExportBasename(
        payload.generationConfig.brand,
        payload.generationConfig.tier,
        payload.generationResult.width,
        payload.generationResult.height,
      );
      downloadBlob(blob, `${base}.pdf`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "PDF 导出失败");
    }
  };

  const handleImageSelect = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const url = URL.createObjectURL(file);

    const imageSize = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const img = new Image();
        img.onload = () =>
          resolve({
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        img.onerror = () => reject(new Error("无法读取图片尺寸"));
        img.src = url;
      },
    );

    if (sourceImageUrl) {
      URL.revokeObjectURL(sourceImageUrl);
    }
    setSourceImage({
      file,
      url,
      width: imageSize.width,
      height: imageSize.height,
    });
    setGenerateError(null);
  };

  type ComputeGenerationOk = {
    ok: true;
    config: GenerationConfig;
    result: PatternGenerationResult;
    analysis: MissingColorAnalysis;
  };

  const computePatternGenerationFromStore =
    useCallback(async (): Promise<
      { ok: false; reason: "no-image" } | ComputeGenerationOk
    > => {
      const s = useProjectStore.getState();
      if (!s.sourceImageFile || !s.sourceImageWidth || !s.sourceImageHeight) {
        return { ok: false, reason: "no-image" };
      }
      const config = normalizeGenerationConfig({
        brand: s.selectedBrand,
        tier: s.selectedTier,
        presetId: s.selectedPresetId,
        generationMode: s.selectedGenerationMode,
        compareOriginal: false,
        targetGridWidth: s.targetGridWidth,
        targetGridHeight: s.targetGridHeight,
        optimization: s.optimization,
        customPaletteMasterIds: s.customPaletteMasterIds,
      });
      const result = await generatePattern({
        image: s.sourceImageFile,
        imageWidth: s.sourceImageWidth,
        imageHeight: s.sourceImageHeight,
        config,
      });
      const analysis = analyzeMissingColors({
        generationResult: result,
        brand: s.selectedBrand,
        tier: s.selectedTier,
        presetId: s.selectedPresetId,
        generationMode: s.selectedGenerationMode,
        customPaletteMasterIds: s.customPaletteMasterIds,
      });
      return { ok: true, config, result, analysis };
    }, []);

  const commitPatternGenerationToStore = useCallback((out: ComputeGenerationOk) => {
    useProjectStore.setState({
      lastGeneratedConfig: out.config,
      generationResult: out.result,
      missingColorAnalysis: out.analysis,
      selectedMasterColorId: out.result.usedMasterIds[0] ?? null,
      historyStack: [],
      redoStack: [],
      baselineCells: cloneCells(out.result.cells),
      ...(out.config.tier === "custom"
        ? { customPaletteMasterIds: out.config.customPaletteMasterIds ?? [] }
        : {}),
    });
  }, []);

  const handleResetPatternToBaseline = () => {
    const store = useProjectStore.getState();
    const gr = store.generationResult;
    const baseline = store.baselineCells;
    if (!gr || !baseline) {
      setEditorToast("请先生成图纸后再重置");
      window.setTimeout(() => setEditorToast(null), 2200);
      return;
    }
    eraserSessionRef.current = { before: null, draft: null };
    setEraserDisplayTick((t) => t + 1);
    store.clearEditorHistory();
    const rebuilt = rebuildGenerationResultWithCells({
      base: gr,
      cells: cloneCells(baseline),
    });
    const analysis = analyzeMissingColors({
      generationResult: rebuilt,
      brand: store.selectedBrand,
      tier: store.selectedTier,
      presetId: store.selectedPresetId,
      generationMode: store.selectedGenerationMode,
      customPaletteMasterIds: store.customPaletteMasterIds,
    });
    store.setEditedGenerationResult(rebuilt);
    store.setMissingColorAnalysis(analysis);
    setEditorToast("已恢复为上次生成结果");
    window.setTimeout(() => setEditorToast(null), 2200);
  };

  const handleGenerate = async () => {
    commitTargetGridWidthDraft();
    commitTargetGridHeightDraft();
    autoRegenGeneration.current += 1;
    setGenerateError(null);
    setPatternGenerationBusy(true);
    try {
      const out = await computePatternGenerationFromStore();
      if (!out.ok) {
        setGenerateError("请先上传一张图片");
        return;
      }
      commitPatternGenerationToStore(out);
      setReplaceSourceMasterId(null);
      setReplaceTargetMasterId(null);
      console.log("[generation-config]", out.config);
      console.log("[pattern-generation-result]", {
        width: out.result.width,
        height: out.result.height,
        paletteCandidateCount: out.result.paletteCandidateCount,
        usedColorCount: out.result.usedColorCount,
        totalBeads: out.result.totalBeads,
        filledBeads: out.result.filledBeads,
      });
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setPatternGenerationBusy(false);
    }
  };

  const patternGenSignature = useCallback(
    (cfg: {
      optimization: typeof optimization;
      brand: BrandId;
      tier: PresetTier;
      presetId: typeof selectedPresetId;
      generationMode: GenerationMode;
      targetGridWidth: number;
      targetGridHeight: number;
      customPaletteMasterIds: string[];
    }) =>
      JSON.stringify({
        optimization: cfg.optimization,
        brand: cfg.brand,
        tier: cfg.tier,
        presetId: cfg.presetId,
        generationMode: cfg.generationMode,
        targetGridWidth: cfg.targetGridWidth,
        targetGridHeight: cfg.targetGridHeight,
        customKit:
          cfg.tier === "custom"
            ? [...cfg.customPaletteMasterIds].sort().join("\0")
            : "",
      }),
    [],
  );

  useEffect(() => {
    if (
      !generationResult ||
      !sourceImageFile ||
      !sourceImageWidth ||
      !sourceImageHeight ||
      !lastGeneratedConfig
    ) {
      return;
    }

    const desired = patternGenSignature({
      optimization,
      brand: selectedBrand,
      tier: selectedTier,
      presetId: selectedPresetId,
      generationMode: selectedGenerationMode,
      targetGridWidth,
      targetGridHeight,
      customPaletteMasterIds,
    });
    const applied = patternGenSignature({
      optimization: lastGeneratedConfig.optimization,
      brand: lastGeneratedConfig.brand,
      tier: lastGeneratedConfig.tier,
      presetId: lastGeneratedConfig.presetId,
      generationMode: lastGeneratedConfig.generationMode,
      targetGridWidth: lastGeneratedConfig.targetGridWidth,
      targetGridHeight: lastGeneratedConfig.targetGridHeight,
      customPaletteMasterIds: lastGeneratedConfig.customPaletteMasterIds ?? [],
    });
    if (desired === applied) {
      return;
    }

    const debounceMs = 400;
    const timer = window.setTimeout(() => {
      const s = useProjectStore.getState();
      if (
        !s.generationResult ||
        !s.sourceImageFile ||
        !s.sourceImageWidth ||
        !s.sourceImageHeight ||
        !s.lastGeneratedConfig
      ) {
        return;
      }
      const d = patternGenSignature({
        optimization: s.optimization,
        brand: s.selectedBrand,
        tier: s.selectedTier,
        presetId: s.selectedPresetId,
        generationMode: s.selectedGenerationMode,
        targetGridWidth: s.targetGridWidth,
        targetGridHeight: s.targetGridHeight,
        customPaletteMasterIds: s.customPaletteMasterIds,
      });
      const a = patternGenSignature({
        optimization: s.lastGeneratedConfig.optimization,
        brand: s.lastGeneratedConfig.brand,
        tier: s.lastGeneratedConfig.tier,
        presetId: s.lastGeneratedConfig.presetId,
        generationMode: s.lastGeneratedConfig.generationMode,
        targetGridWidth: s.lastGeneratedConfig.targetGridWidth,
        targetGridHeight: s.lastGeneratedConfig.targetGridHeight,
        customPaletteMasterIds: s.lastGeneratedConfig.customPaletteMasterIds ?? [],
      });
      if (d === a) return;

      const gen = ++autoRegenGeneration.current;
      void (async () => {
        setPatternGenerationBusy(true);
        setGenerateError(null);
        try {
          const out = await computePatternGenerationFromStore();
          if (gen !== autoRegenGeneration.current) return;
          if (!out.ok) return;
          commitPatternGenerationToStore(out);
          setReplaceSourceMasterId(null);
          setReplaceTargetMasterId(null);
        } catch (e) {
          if (gen !== autoRegenGeneration.current) return;
          setGenerateError(e instanceof Error ? e.message : "根据设置重新生成失败");
        } finally {
          if (gen === autoRegenGeneration.current) {
            setPatternGenerationBusy(false);
          }
        }
      })();
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [
    generationResult,
    sourceImageFile,
    sourceImageWidth,
    sourceImageHeight,
    lastGeneratedConfig,
    optimization,
    selectedBrand,
    selectedTier,
    selectedPresetId,
    selectedGenerationMode,
    targetGridWidth,
    targetGridHeight,
    customPaletteMasterIds,
    patternGenSignature,
    computePatternGenerationFromStore,
    commitPatternGenerationToStore,
  ]);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col bg-transparent text-loom-on-surface",
        immersiveAssembly
          ? "p-0 sm:p-1 lg:p-2"
          : "p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4 sm:pb-4 lg:p-6",
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full min-w-0 flex-1 flex-col gap-4",
          immersiveAssembly
            ? "max-w-none min-h-0"
            : "max-w-[min(100%,var(--workspace-max))] min-h-0",
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-3 border-b border-loom-outline-variant/20 bg-loom-surface-lowest px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4 lg:px-8",
            immersiveAssembly && "hidden",
          )}
        >
          <label className="flex w-full min-w-0 flex-1 flex-col gap-1.5 text-xs text-loom-on-surface-variant sm:min-w-[10rem] sm:flex-row sm:items-center sm:gap-2">
            <span className="shrink-0 font-medium text-loom-on-surface-variant">项目名称</span>
            <input
              type="text"
              value={currentProjectName}
              onChange={(e) => setCurrentProjectName(e.target.value)}
              placeholder="未命名项目"
              className="min-w-0 flex-1 rounded-lg border border-loom-outline-variant/25 bg-white px-2.5 py-1.5 text-sm text-loom-on-surface outline-none ring-loom-primary-container/40 focus:ring-2"
            />
          </label>
          <button
            type="button"
            disabled={saveBusy}
            className={cn(
              "w-full shrink-0 rounded-xl px-4 py-2.5 text-xs font-medium text-white transition sm:w-auto sm:py-2",
              saveBusy ? "cursor-wait bg-loom-outline-variant/60" : "loom-primary-gradient hover:opacity-90",
            )}
            onClick={() => {
              setSaveBusy(true);
              void saveProject()
                .then(() => {
                  setEditorToast("已保存到创作历史");
                  window.setTimeout(() => setEditorToast(null), 2200);
                })
                .catch((e) => {
                  setEditorToast(e instanceof Error ? e.message : "保存失败");
                  window.setTimeout(() => setEditorToast(null), 3200);
                })
                .finally(() => setSaveBusy(false));
            }}
          >
            {saveBusy ? "保存中…" : "保存项目"}
          </button>
          <p className="w-full text-[11px] text-loom-on-surface-variant sm:w-auto sm:flex-1">
            在「创作历史」中可打开最近保存的项目。
          </p>
        </div>

        <main
          className={cn(
            "grid min-h-0 min-w-0 flex-1 grid-cols-1 items-stretch gap-3 sm:gap-4 lg:min-h-[calc(100dvh-5rem)] lg:gap-3",
            immersiveAssembly
              ? "min-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] lg:min-h-[calc(100dvh-0.5rem)]"
              : "min-h-[min(400px,calc(100dvh-9rem))] max-sm:gap-2 lg:min-h-[min(760px,calc(100dvh-7rem))] lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)_minmax(260px,340px)]",
          )}
        >
          <aside
            className={cn(
              "order-2 flex min-h-0 flex-col overflow-hidden border-loom-outline-variant/20 bg-loom-surface-low lg:order-none lg:max-h-[calc(100dvh-5rem)] lg:rounded-2xl lg:border lg:bg-loom-surface-container-low lg:shadow-sm lg:ring-1 lg:ring-loom-outline-variant/10",
              immersiveAssembly && "hidden",
            )}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-3 pt-3 pb-2 [-webkit-overflow-scrolling:touch] lg:px-4">
              <input
                ref={sourceImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                className="hidden"
                aria-hidden
                onChange={handleImageSelect}
              />

              <section>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-loom-on-surface-variant">
                  图源与底板
                </p>
                <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-loom-outline-variant/15">
                <div className="relative mx-auto flex aspect-square w-full max-w-[min(160px,55vw)] flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-loom-outline-variant/35 bg-loom-surface-container shadow-inner sm:mx-0 sm:max-w-[160px]">
                  {sourceImageUrl ? (
                    <>
                      <img
                        src={sourceImageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <button
                        type="button"
                        className="relative z-10 mt-auto mb-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-loom-on-surface shadow-sm ring-1 ring-loom-outline-variant/25"
                        onClick={() => sourceImageInputRef.current?.click()}
                      >
                        更换图片
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                      <button
                        type="button"
                        className="loom-primary-gradient rounded-lg px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:opacity-90"
                        onClick={() => sourceImageInputRef.current?.click()}
                      >
                        上传图片
                      </button>
                      <p className="text-[11px] leading-snug text-loom-on-surface-variant">
                        支持 JPG、PNG、WebP、GIF 等常见图片格式
                      </p>
                    </div>
                  )}
                </div>
                {sourceImageFile && sourceImageWidth && sourceImageHeight ? (
                  <p className="mt-2 truncate text-[11px] text-loom-on-surface-variant" title={sourceImageFile.name}>
                    {sourceImageFile.name} · {sourceImageWidth}×{sourceImageHeight}
                  </p>
                ) : null}
                <p className="mt-2 text-[10px] text-loom-on-surface-variant">网格宽高（珠）</p>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] font-medium text-loom-on-surface-variant">宽</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      aria-label="底板网格宽度（珠）"
                      value={targetGridWidthDraft}
                      onChange={(e) =>
                        setTargetGridWidthDraft(digitsOnlyGridDraft(e.target.value))
                      }
                      onBlur={commitTargetGridWidthDraft}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="w-full rounded-lg border border-loom-outline-variant/25 bg-loom-surface-low/80 px-1.5 py-1.5 text-sm text-loom-on-surface outline-none ring-loom-primary-container/40 focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] font-medium text-loom-on-surface-variant">高</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      aria-label="底板网格高度（珠）"
                      value={targetGridHeightDraft}
                      onChange={(e) =>
                        setTargetGridHeightDraft(digitsOnlyGridDraft(e.target.value))
                      }
                      onBlur={commitTargetGridHeightDraft}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="w-full rounded-lg border border-loom-outline-variant/25 bg-loom-surface-low/80 px-1.5 py-1.5 text-sm text-loom-on-surface outline-none ring-loom-primary-container/40 focus:ring-2"
                    />
                  </label>
                </div>
                </div>
              </section>

              <section>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-loom-on-surface-variant">
                  品牌与套装
                </p>
                <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-loom-outline-variant/15">
                <p className="text-[10px] font-medium text-loom-on-surface-variant">品牌</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {enabledBrands.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      aria-pressed={selectedBrand === b.id}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-[11px] font-medium transition",
                        selectedBrand === b.id
                          ? "loom-primary-gradient text-white shadow-sm hover:opacity-90"
                          : "bg-loom-surface-low/80 text-loom-on-surface ring-1 ring-loom-outline-variant/20 hover:bg-white",
                      )}
                      onClick={() => setSelectedBrand(b.id)}
                    >
                      {b.displayName}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] font-medium text-loom-on-surface-variant">套装 / 色板</p>
                <div className="mt-1 grid grid-cols-5 gap-1">
                  {tierPresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={cn(
                        "rounded-md px-0.5 py-1.5 text-[10px] font-medium leading-tight transition",
                        selectedPresetId === p.id
                          ? "loom-primary-gradient text-white shadow-sm hover:opacity-90"
                          : "bg-loom-surface-low/80 text-loom-on-surface ring-1 ring-loom-outline-variant/20 hover:bg-white",
                      )}
                      onClick={() => applyPresetSelection(p.id)}
                    >
                      {p.displayName}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!customPreset}
                    aria-pressed={
                      customPreset ? selectedPresetId === customPreset.id : false
                    }
                    className={cn(
                      "col-span-5 mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed px-2 py-1.5 text-[10px] font-medium transition",
                      customPreset && selectedPresetId === customPreset.id
                        ? "border-loom-primary loom-primary-gradient text-white"
                        : "border-loom-outline-variant/35 bg-loom-surface-low/80 text-loom-on-surface hover:bg-white",
                      !customPreset && "cursor-not-allowed opacity-50",
                    )}
                    onClick={() => setCustomPaletteOpen(true)}
                  >
                    <span aria-hidden>✎</span>
                    自定义
                    {selectedTier === "custom" && customPaletteMasterIds.length > 0 ? (
                      <span className="opacity-80">（{customPaletteMasterIds.length}）</span>
                    ) : null}
                  </button>
                </div>
                </div>
              </section>

              <section>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-loom-on-surface-variant">
                  生成模式
                </p>
                <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-loom-outline-variant/15">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="生成模式">
                  {GENERATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selectedGenerationMode === option.value}
                      className={cn(
                        "flex-1 min-w-0 rounded-lg px-2 py-2 text-[11px] font-medium transition sm:min-w-[6.5rem]",
                        selectedGenerationMode === option.value
                          ? "loom-primary-gradient text-white shadow-sm hover:opacity-90"
                          : "bg-loom-surface-low/80 text-loom-on-surface ring-1 ring-loom-outline-variant/20 hover:bg-white",
                      )}
                      onClick={() => setSelectedGenerationMode(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {selectedGenerationMode === "allow-refill" ? (
                  <div className="mt-2 border-t border-loom-outline-variant/10 pt-2">
                    <span className="text-[11px] font-medium text-loom-on-surface">最大补色数</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      placeholder="不限制"
                      value={optimization.maxRefillColors === null ? "" : optimization.maxRefillColors}
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        if (raw === "") {
                          setOptimization({ maxRefillColors: null });
                          return;
                        }
                        const n = Math.max(0, Math.min(999, Math.floor(Number(raw)) || 0));
                        setOptimization({ maxRefillColors: n });
                      }}
                      className="mt-1 w-full rounded-lg border border-loom-outline-variant/25 bg-loom-surface-low/80 px-2 py-1.5 text-sm text-loom-on-surface"
                    />
                  </div>
                ) : null}
                </div>
              </section>

              <details className="rounded-xl border border-dashed border-loom-outline-variant/35 bg-white/90 shadow-sm ring-1 ring-loom-outline-variant/10">
                <summary className="cursor-pointer select-none list-none rounded-xl px-3 py-2 text-[11px] font-semibold text-loom-on-surface [&::-webkit-details-marker]:hidden">
                  <span className="mr-1.5 text-loom-on-surface-variant" aria-hidden>
                    ⚙
                  </span>
                  高级生成设置
                  <span className="ml-1 text-loom-on-surface-variant">（展开）</span>
                </summary>
                <div className="space-y-2 border-t border-loom-outline-variant/15 px-4 pb-3 pt-3">
                  <p className="text-[11px] leading-snug text-loom-on-surface-variant">
                    默认使用「标准」参数。选项会保存在本浏览器。已生成图纸时，改动后约 0.4s 会自动重新生成（覆盖画布与撤销栈）。
                  </p>
                  <button
                    type="button"
                    onClick={() => resetOptimizationToStandard()}
                    className="w-full rounded-lg bg-loom-surface-low px-2 py-2 text-[11px] font-medium text-loom-on-surface ring-1 ring-loom-outline-variant/25 transition hover:bg-white"
                  >
                    恢复标准默认
                  </button>
                </div>
                <div className="space-y-4 border-t border-loom-outline-variant/15 px-4 pb-4 pt-3">
                  <div>
                    <div className="text-xs font-semibold text-loom-on-surface">处理模式</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PROCESSING_MODE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          title={option.hint}
                          aria-pressed={optimization.processingMode === option.value}
                          className={cn(
                            "rounded-lg px-2.5 py-2 text-xs font-medium transition",
                            optimization.processingMode === option.value
                              ? "loom-primary-gradient text-white shadow-sm hover:opacity-90"
                              : "bg-white text-loom-on-surface ring-1 ring-loom-outline-variant/25 hover:bg-loom-surface-low",
                          )}
                          onClick={() => applyProcessingModePreset(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] leading-snug text-loom-on-surface-variant">
                      {
                        PROCESSING_MODE_OPTIONS.find(
                          (o) => o.value === optimization.processingMode,
                        )?.hint
                      }
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-loom-on-surface">抖动算法</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {DITHERING_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={optimization.dithering === option.value}
                          className={cn(
                            "rounded-lg px-2.5 py-2 text-xs font-medium transition",
                            optimization.dithering === option.value
                              ? "loom-primary-gradient text-white shadow-sm hover:opacity-90"
                              : "bg-white text-loom-on-surface ring-1 ring-loom-outline-variant/25 hover:bg-loom-surface-low",
                          )}
                          onClick={() =>
                            setOptimization({ dithering: option.value as DitheringMode })
                          }
                        >
                          {option.value === "none" ? "无" : option.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-loom-on-surface-variant">
                      缩放至底板网格后、映射到套装主色前处理，减轻色块边缘。
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-loom-on-surface-variant">
                      最小用量合并
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={30}
                        value={Math.min(30, optimization.minColorUsageMergeThreshold)}
                        onChange={(event) =>
                          setOptimization({
                            minColorUsageMergeThreshold: Number(event.target.value),
                          })
                        }
                        className="min-w-[120px] flex-1"
                      />
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={optimization.minColorUsageMergeThreshold}
                        onChange={(event) =>
                          setOptimization({
                            minColorUsageMergeThreshold: Math.max(
                              0,
                              Math.min(
                                999,
                                Math.floor(Number(event.target.value)) || 0,
                              ),
                            ),
                          })
                        }
                        className="w-[4.5rem] rounded-lg border border-loom-outline-variant/25 bg-white px-2 py-1.5 text-right text-sm text-loom-on-surface"
                      />
                      <span className="text-[11px] text-loom-on-surface-variant">颗</span>
                    </div>
                    <p className="mt-1 text-[11px] text-loom-on-surface-variant">
                      整颗数少于 N 的主色会并入视觉上最接近的「高频」主色；0 关闭。
                    </p>
                  </label>

                  <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white/80 p-2 ring-1 ring-loom-outline-variant/10">
                    <input
                      type="checkbox"
                      checked={optimization.cleanIsolatedPixels}
                      onChange={(event) =>
                        setOptimization({ cleanIsolatedPixels: event.target.checked })
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="text-xs font-medium text-loom-on-surface">孤立点清理</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-loom-on-surface-variant">
                        四邻同色且与中心格主色不同时，将中心改为该邻色，去掉单格噪点。
                      </span>
                    </span>
                  </label>

                  <details className="rounded-lg border border-loom-outline-variant/25/80 bg-white/70 ring-1 ring-loom-outline-variant/10">
                    <summary className="cursor-pointer select-none list-none px-2 py-2 text-[11px] font-semibold text-loom-on-surface-variant [&::-webkit-details-marker]:hidden">
                      <span className="mr-1 text-loom-on-surface-variant">▸</span>
                      质量增强（相近色 / 小区域 / 背景）
                    </summary>
                    <div className="space-y-3 border-t border-slate-100 px-2 pb-3 pt-2">
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white/80 p-2 ring-1 ring-loom-outline-variant/10">
                        <input
                          type="checkbox"
                          checked={optimization.mergeSimilarColors}
                          onChange={(event) =>
                            setOptimization({ mergeSimilarColors: event.target.checked })
                          }
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-xs font-medium text-loom-on-surface">
                            相近色合并
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-loom-on-surface-variant">
                            将 RGB 非常接近的已用主色合并，减少难分辨色（保留用量更高的一侧）。
                          </span>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-loom-on-surface-variant">距离阈值</span>
                            <input
                              type="range"
                              min={0}
                              max={60}
                              value={Math.min(60, optimization.similarColorDistanceThreshold)}
                              onChange={(event) =>
                                setOptimization({
                                  similarColorDistanceThreshold: Number(event.target.value),
                                })
                              }
                              className="min-w-[100px] flex-1"
                            />
                            <input
                              type="number"
                              min={0}
                              max={441}
                              value={optimization.similarColorDistanceThreshold}
                              onChange={(event) =>
                                setOptimization({
                                  similarColorDistanceThreshold: Math.max(
                                    0,
                                    Math.min(
                                      441,
                                      Math.floor(Number(event.target.value)) || 0,
                                    ),
                                  ),
                                })
                              }
                              className="w-[4rem] rounded border border-loom-outline-variant/25 bg-white px-1.5 py-1 text-right text-xs text-loom-on-surface"
                            />
                            <span className="text-[11px] text-loom-on-surface-variant">RGB 欧氏</span>
                          </div>
                        </span>
                      </label>

                      <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white/80 p-2 ring-1 ring-loom-outline-variant/10">
                        <input
                          type="checkbox"
                          checked={optimization.mergeSmallRegions}
                          onChange={(event) =>
                            setOptimization({ mergeSmallRegions: event.target.checked })
                          }
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-xs font-medium text-loom-on-surface">
                            小区域合并
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-loom-on-surface-variant">
                            面积不超过 N 格的同色连通块并入边界上最多的邻色，弱化碎岛。
                          </span>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-loom-on-surface-variant">面积阈值</span>
                            <input
                              type="number"
                              min={1}
                              max={200}
                              value={optimization.smallRegionAreaThreshold}
                              onChange={(event) =>
                                setOptimization({
                                  smallRegionAreaThreshold: Math.max(
                                    1,
                                    Math.min(
                                      200,
                                      Math.floor(Number(event.target.value)) || 1,
                                    ),
                                  ),
                                })
                              }
                              className="w-[4.5rem] rounded border border-loom-outline-variant/25 bg-white px-2 py-1 text-right text-xs text-loom-on-surface"
                            />
                            <span className="text-[11px] text-loom-on-surface-variant">格</span>
                          </div>
                        </span>
                      </label>

                      <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white/80 p-2 ring-1 ring-loom-outline-variant/10">
                        <input
                          type="checkbox"
                          checked={optimization.simplifyBackground}
                          onChange={(event) =>
                            setOptimization({ simplifyBackground: event.target.checked })
                          }
                          className="mt-0.5"
                        />
                        <span>
                          <span className="text-xs font-medium text-loom-on-surface">
                            背景简化
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-loom-on-surface-variant">
                            在距四边约 15% 宽高的边缘带内，额外合并较小连通块，压缩背景细碎色。
                          </span>
                        </span>
                      </label>
                    </div>
                  </details>
                </div>
              </details>

              <div className="border-t border-loom-outline-variant/15 pt-3">
                <button
                  type="button"
                  disabled={patternGenerationBusy || strictCustomBlocked}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-sm font-bold text-white transition",
                    patternGenerationBusy || strictCustomBlocked
                      ? "cursor-not-allowed bg-loom-outline-variant"
                      : "loom-primary-gradient hover:opacity-90",
                  )}
                  onClick={() => void handleGenerate()}
                >
                  {patternGenerationBusy
                    ? "处理中…"
                    : generationResult
                      ? "重新生成图纸"
                      : "生成图纸"}
                </button>
                <button
                  type="button"
                  disabled={
                    !sourceImageFile || patternGenerationBusy || strictCustomBlocked
                  }
                  className={cn(
                    "mt-1.5 w-full rounded-xl px-3 py-2 text-xs font-semibold transition ring-1",
                    sourceImageFile && !patternGenerationBusy && !strictCustomBlocked
                      ? "bg-white text-loom-on-surface ring-loom-primary-container/35 hover:bg-loom-surface-low"
                      : "cursor-not-allowed bg-loom-surface-container-high text-loom-on-surface-variant ring-loom-outline-variant/10",
                  )}
                  onClick={() => setSchemeCompareOpen(true)}
                >
                  比较方案
                </button>
                {strictCustomBlocked ? (
                  <p className="mt-1.5 text-[10px] leading-snug text-amber-800">
                    自定义色板 + 严格套装：请先选色或导入 CSV。
                  </p>
                ) : null}
                {generateError ? (
                  <p className="mt-1 text-[11px] text-rose-600">{generateError}</p>
                ) : null}
              </div>
            </div>
            </div>
          </aside>

          <section
            ref={immersiveStageRef}
            className={cn(
              "relative order-1 flex min-h-0 min-w-0 flex-col bg-loom-surface lg:order-none lg:sticky lg:z-20 lg:self-start lg:overflow-hidden",
              immersiveAssembly
                ? "max-lg:min-h-0 max-lg:flex-1 lg:top-2 lg:max-h-[calc(100dvh-1rem)]"
                : "lg:top-4 lg:max-h-[min(100dvh-5rem,calc(100vh-2rem))]",
            )}
            aria-label="画布"
          >
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="pointer-events-none absolute inset-0 -z-0 opacity-[0.14] loom-bead-pattern" aria-hidden />
              <div
                className={cn(
                  "absolute left-1/2 top-4 z-20 flex w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 flex-nowrap items-center justify-start gap-1 overflow-x-auto overflow-y-hidden rounded-xl border border-loom-outline-variant/20 bg-white/95 px-2 py-2 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x_pan-y] sm:flex-wrap sm:justify-center sm:overflow-visible sm:gap-1.5 sm:px-3 [&::-webkit-scrollbar]:hidden",
                  immersiveAssembly && "hidden",
                )}
                role="toolbar"
                aria-label="画布工具"
              >
                {TOOL_OPTIONS.map((tool) => (
                  <button
                    key={tool.value}
                    type="button"
                    title={tool.hint ? `${tool.label}：${tool.hint}` : tool.label}
                    className={cn(
                      "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                      activeTool === tool.value
                        ? "loom-primary-gradient text-white shadow-sm hover:opacity-90"
                        : "bg-loom-surface-low text-loom-on-surface ring-1 ring-loom-outline-variant/20 hover:bg-loom-surface-container-high",
                    )}
                    onClick={() => setActiveTool(tool.value)}
                  >
                    {tool.label}
                  </button>
                ))}
                <span
                  className="mx-0.5 hidden h-6 w-px shrink-0 bg-loom-outline-variant/30 sm:inline-block"
                  aria-hidden
                />
                <button
                  type="button"
                  disabled={historyStack.length === 0}
                  title="撤销"
                  className={cn(
                    "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                    historyStack.length > 0
                      ? "bg-loom-surface-low text-loom-on-surface ring-1 ring-loom-outline-variant/20 hover:bg-loom-surface-container-high"
                      : "cursor-not-allowed text-loom-on-surface-variant/50 ring-1 ring-loom-outline-variant/10",
                  )}
                  onClick={handleUndo}
                >
                  撤销
                </button>
                <button
                  type="button"
                  disabled={redoStack.length === 0}
                  title="重做"
                  className={cn(
                    "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                    redoStack.length > 0
                      ? "bg-loom-surface-low text-loom-on-surface ring-1 ring-loom-outline-variant/20 hover:bg-loom-surface-container-high"
                      : "cursor-not-allowed text-loom-on-surface-variant/50 ring-1 ring-loom-outline-variant/10",
                  )}
                  onClick={handleRedo}
                >
                  重做
                </button>
                <button
                  type="button"
                  disabled={!generationResult || !baselineCells}
                  title="撤销画笔、橡皮、批量替色等编辑，恢复为上次「生成图纸」结果"
                  className={cn(
                    "hidden shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ring-1 sm:inline-flex",
                    generationResult && baselineCells
                      ? "bg-white text-rose-800 ring-rose-200 hover:bg-rose-50"
                      : "cursor-not-allowed bg-loom-surface-container-high text-loom-on-surface-variant ring-loom-outline-variant/10",
                  )}
                  onClick={handleResetPatternToBaseline}
                >
                  重置编辑
                </button>
                <span
                  className="mx-0.5 hidden h-6 w-px shrink-0 bg-loom-outline-variant/30 sm:inline-block"
                  aria-hidden
                />
                <span className="hidden text-[10px] font-semibold text-loom-on-surface-variant sm:inline">
                  缩放
                </span>
                <button
                  type="button"
                  aria-label="缩小"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg font-medium text-loom-on-surface-variant ring-1 ring-loom-outline-variant/20 transition hover:bg-loom-surface-low"
                  onClick={() => setZoom(Math.max(0.5, Number((zoom - 0.1).toFixed(1))))}
                >
                  −
                </button>
                <span className="min-w-[2.75rem] text-center text-xs font-semibold tabular-nums text-loom-on-surface">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  aria-label="放大"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg font-medium text-loom-on-surface-variant ring-1 ring-loom-outline-variant/20 transition hover:bg-loom-surface-low"
                  onClick={() => setZoom(Math.min(3, Number((zoom + 0.1).toFixed(1))))}
                >
                  +
                </button>
                {generationResult && !immersiveAssembly ? (
                  <button
                    type="button"
                    disabled={colorUsageStats.length === 0}
                    title="最大化画布并按色号逐粒高亮（← → 切换色号，Esc 退出）"
                    className={cn(
                      "ml-0.5 flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold text-white shadow-sm transition sm:ml-1",
                      colorUsageStats.length > 0
                        ? "bg-loom-on-surface hover:opacity-90"
                        : "cursor-not-allowed bg-loom-surface-container-high text-loom-on-surface-variant",
                    )}
                    onClick={enterImmersiveAssembly}
                  >
                    <span className="text-sm" aria-hidden>
                      ◎
                    </span>
                    沉浸拼装
                  </button>
                ) : null}
              </div>

              {immersiveAssembly ? (
                <div
                  className="absolute left-1/2 top-0 z-20 flex w-[calc(100%-0.75rem)] max-w-5xl -translate-x-1/2 flex-col gap-2 rounded-2xl border border-loom-outline-variant/25 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] shadow-xl backdrop-blur-md sm:left-1/2 sm:w-[calc(100%-1.25rem)] sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:px-3 sm:py-2.5"
                  style={{ background: "rgba(255,255,255,0.94)" }}
                >
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      className="min-h-11 min-w-[5.5rem] rounded-xl bg-white px-3 py-2 text-xs font-semibold text-loom-on-surface ring-2 ring-loom-primary-container/35 hover:bg-loom-surface-low sm:min-h-10"
                      onClick={exitImmersiveAssembly}
                    >
                      退出沉浸
                    </button>
                    <span className="hidden text-[10px] font-medium text-loom-on-surface-variant sm:inline">
                      Esc
                    </span>
                    {fullscreenCapable ? (
                      <button
                        type="button"
                        className="min-h-11 rounded-xl bg-loom-on-surface px-3 py-2 text-xs font-semibold text-white hover:opacity-90 sm:min-h-10"
                        onClick={() => void toggleImmersiveFullscreen()}
                      >
                        {fullscreenElementActive ? "退出全屏" : "全屏底板"}
                      </button>
                    ) : null}
                  </div>
                  <div className="hidden h-8 w-px shrink-0 bg-loom-outline-variant/30 sm:block" aria-hidden />
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="w-full text-[11px] font-semibold text-loom-on-surface-variant sm:w-auto">
                      逐色
                    </span>
                    <button
                      type="button"
                      className="min-h-11 flex-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-loom-on-surface ring-1 ring-loom-outline-variant/30 hover:bg-loom-surface-low sm:min-h-10 sm:flex-none"
                      onClick={immersivePrevColor}
                    >
                      上一色
                    </button>
                    <button
                      type="button"
                      className="min-h-11 flex-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-loom-on-surface ring-1 ring-loom-outline-variant/30 hover:bg-loom-surface-low sm:min-h-10 sm:flex-none"
                      onClick={immersiveNextColor}
                    >
                      下一色
                    </button>
                    <button
                      type="button"
                      aria-pressed={immersiveFocusMasterId === null}
                      className={cn(
                        "min-h-11 w-full rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition sm:min-h-10 sm:w-auto",
                        immersiveFocusMasterId === null
                          ? "loom-primary-gradient text-white ring-loom-primary hover:opacity-90"
                          : "bg-white text-loom-on-surface ring-loom-outline-variant/30 hover:bg-loom-surface-low",
                      )}
                      onClick={() => setImmersiveFocusMasterId(null)}
                    >
                      显示全部
                    </button>
                  </div>
                  <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y]">
                    <div className="flex w-max gap-1.5 pr-1">
                      {colorUsageStats.map((s) => {
                        const active = immersiveFocusMasterId === s.masterId;
                        return (
                          <button
                            key={s.masterId}
                            type="button"
                            title={`${cellEditorDisplayCode(selectedBrand, s.masterId)} · ${s.count} 颗`}
                            className={cn(
                              "flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-[11px] font-semibold ring-1 transition sm:min-h-10",
                              active
                                ? "loom-primary-gradient text-white ring-loom-primary hover:opacity-90"
                                : "bg-white text-loom-on-surface ring-loom-outline-variant/30 hover:bg-loom-surface-low",
                            )}
                            onClick={() => {
                              setImmersiveFocusMasterId(s.masterId);
                              setSelectedMasterColorId(s.masterId);
                            }}
                          >
                            <span
                              className="size-4 shrink-0 rounded-md border border-loom-outline-variant/30"
                              style={{ backgroundColor: s.hex }}
                              aria-hidden
                            />
                            <span className="font-mono tabular-nums">
                              {cellEditorDisplayCode(selectedBrand, s.masterId)}
                            </span>
                            <span className="tabular-nums opacity-80">{s.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              <div
                className={cn(
                  "relative z-0 mx-1.5 mb-2 mt-[4.25rem] flex min-h-0 flex-1 flex-col sm:mx-3",
                  immersiveAssembly && "mt-[min(13rem,calc(env(safe-area-inset-top,0px)+11.5rem))] sm:mt-36",
                  immersiveAssembly
                    ? "min-h-0 flex-1 lg:min-h-[calc(100dvh-10rem)]"
                    : "min-h-[min(42svh,min(420px,calc(100dvh-12rem)))] sm:min-h-[min(52vh,520px)]",
                )}
              >
                <div
                  ref={immersiveGridMeasureRef}
                  className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain rounded-lg border border-loom-outline-variant/20 bg-white shadow-sm [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y]"
                >
                {(() => {
                  void eraserDisplayTick;
                  const gw = generationResult?.width ?? targetGridWidth;
                  const gh = generationResult?.height ?? targetGridHeight;
                  const cellPx = immersiveCellPx;
                  const liveCells = generationResult
                    ? (eraserSessionRef.current.draft ?? generationResult.cells)
                    : null;
                  const canEdit = Boolean(generationResult);
                  return (
                    <div
                      className={cn(
                        "flex min-h-full min-w-min flex-col items-center px-3 py-4 sm:px-8 sm:py-8",
                        immersiveAssembly && "px-2 py-3 sm:px-4 sm:py-4",
                      )}
                    >
                      <p
                        className={cn(
                          "mb-4 w-full max-w-[min(100%,80rem)] text-center text-[11px] text-loom-on-surface-variant",
                          immersiveAssembly && "mb-2 text-[10px] sm:mb-3 sm:text-[11px]",
                        )}
                      >
                        底板网格 <strong>{gw}×{gh}</strong> 珠
                        {generationResult
                          ? " · 格内为当前品牌色号"
                          : " · 上传图片并生成后填充颜色与色号"}
                      </p>
                      <div
                        className="inline-grid select-none [touch-action:pan-x_pan-y]"
                        style={{
                          gridTemplateColumns: `repeat(${gw}, ${cellPx}px)`,
                          width: gw * cellPx,
                        }}
                        onPointerLeave={() => setHoverGridCell(null)}
                      >
                        {Array.from({ length: gh }, (_, y) =>
                          Array.from({ length: gw }, (_, x) => {
                            const cell =
                              liveCells?.[y]?.[x] ??
                              ({ x, y, masterColorId: null } satisfies PatternCell);
                            const mid = cell.masterColorId;
                            const isEmpty = mid === null;
                            const color = isEmpty ? null : getMasterColorById(mid);
                            const hex = color?.hex ?? "#ffffff";
                            const tip = isEmpty
                              ? "空白格"
                              : cellTooltipLabel(selectedBrand, mid!, color?.hex ?? "");
                            const showCode = !isEmpty && cellPx >= 11;
                            const immersiveSpotlight =
                              immersiveAssembly &&
                              immersiveFocusMasterId !== null &&
                              !isEmpty &&
                              mid === immersiveFocusMasterId;
                            const immersiveDim =
                              immersiveAssembly &&
                              immersiveFocusMasterId !== null &&
                              !immersiveSpotlight;
                            return (
                              <div
                                key={`${x}-${y}`}
                                title={tip}
                                className={cn(
                                  "relative box-border border border-loom-outline-variant/25 transition-[opacity,filter,box-shadow] duration-150",
                                  canEdit && activeTool !== "select"
                                    ? "cursor-pointer"
                                    : "cursor-default",
                                  immersiveDim &&
                                    "opacity-[0.06] brightness-[0.35] contrast-[0.85] saturate-[0.35]",
                                  immersiveSpotlight &&
                                    "z-[2] ring-2 ring-amber-400 shadow-[0_0_0_1px_rgba(255,255,255,0.9),0_0_12px_2px_rgba(251,191,36,0.65)]",
                                )}
                                style={{
                                  width: cellPx,
                                  height: cellPx,
                                  ...(isEmpty
                                    ? EMPTY_CELL_BG_STYLE
                                    : { backgroundColor: hex }),
                                }}
                                onPointerDown={
                                  canEdit
                                    ? (e) => handleCellPointerDown(cell.x, cell.y, e)
                                    : undefined
                                }
                                onPointerEnter={
                                  canEdit
                                    ? (e) => {
                                        setHoverGridCell({ x: cell.x, y: cell.y });
                                        handleCellPointerEnter(cell.x, cell.y, e);
                                      }
                                    : () => setHoverGridCell({ x: cell.x, y: cell.y })
                                }
                              >
                                {showCode ? (
                                  <span
                                    className="pointer-events-none absolute inset-0 flex items-center justify-center px-0.5 text-center font-mono font-semibold leading-none tracking-tight"
                                    style={{
                                      fontSize: Math.min(10, cellPx * 0.36),
                                      color: labelTextColorForHex(hex),
                                      textShadow:
                                        labelTextColorForHex(hex) === "#ffffff"
                                          ? "0 0 2px rgba(0,0,0,0.65), 0 0 4px rgba(0,0,0,0.35)"
                                          : "0 0 2px rgba(255,255,255,0.5)",
                                    }}
                                  >
                                    {cellEditorDisplayCode(selectedBrand, mid!)}
                                  </span>
                                ) : null}
                              </div>
                            );
                          }),
                        ).flat()}
                      </div>
                    </div>
                  );
                })()}
                </div>
                <p
                  className={cn(
                    "shrink-0 border-t border-loom-outline-variant/10 pt-2 text-center text-xs text-loom-on-surface-variant",
                    immersiveAssembly &&
                      "pt-1.5 text-[10px] leading-tight text-loom-on-surface-variant/90 sm:text-xs",
                  )}
                  aria-live="polite"
                >
                  坐标 {hoverGridCell ? `${hoverGridCell.x}，${hoverGridCell.y}` : "—"} · 缩放{" "}
                  {Math.round(zoom * 100)}% · 已填充{" "}
                  {generationResult
                    ? `${generationResult.filledBeads} / ${generationResult.totalBeads}`
                    : "—"}
                </p>
              </div>
            </div>
          </section>

          <aside
            className={cn(
              "order-3 flex min-h-0 flex-col overflow-hidden border-loom-outline-variant/20 bg-loom-surface-low lg:order-none lg:max-h-[calc(100dvh-5rem)] lg:rounded-2xl lg:border lg:bg-loom-surface-container-low lg:shadow-sm lg:ring-1 lg:ring-loom-outline-variant/10",
              immersiveAssembly && "hidden",
            )}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-3 pb-2 pt-3 [-webkit-overflow-scrolling:touch] lg:px-4">
                <section>
                  <p className="mb-2 text-xs font-bold text-loom-on-surface">当前画笔</p>
                  {!generationResult ? (
                    <div className="rounded-lg border border-loom-outline-variant/15 bg-white p-3 text-sm text-loom-on-surface-variant">
                      生成图纸后在此查看与切换画笔颜色。
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-lg border border-loom-outline-variant/15 bg-loom-surface-lowest p-3 shadow-sm transition",
                        activeTool === "brush"
                          ? "ring-2 ring-loom-primary-container/40"
                          : "",
                      )}
                    >
                      {selectedMasterColorId ? (
                        <>
                          <div
                            className="h-12 w-12 shrink-0 rounded-lg shadow-inner ring-2 ring-loom-primary-container/35"
                            style={{
                              backgroundColor:
                                getMasterColorById(selectedMasterColorId)?.hex ?? "#e2e8f0",
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-mono text-base font-bold leading-tight text-loom-on-surface">
                              {formatMasterOptionLabel(selectedBrand, selectedMasterColorId)}
                            </h4>
                            <p className="mt-1 text-xs text-loom-on-surface-variant">
                              {getMasterColorById(selectedMasterColorId)?.hex ?? "—"} ·{" "}
                              {colorUsageStats.find((s) => s.masterId === selectedMasterColorId)
                                ?.count ?? 0}{" "}
                              颗
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="py-0.5">
                          <p className="text-sm font-semibold text-loom-on-surface">未选色</p>
                          <p className="mt-1 text-xs leading-relaxed text-loom-on-surface-variant">
                            吸色或点击下方色块选择。
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-loom-on-surface">
                      已用颜色
                      {generationResult ? (
                        <span className="ml-1 font-normal text-loom-on-surface-variant">
                          ({colorUsageStats.length})
                        </span>
                      ) : null}
                    </p>
                    {generationResult ? (
                      <button
                        type="button"
                        className="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-loom-primary ring-1 ring-loom-primary-container/50 hover:bg-loom-surface-low"
                        onClick={() => {
                          const csv = buildColorUsageStatsCsv(
                            selectedBrand,
                            colorUsageStats,
                            generationResult.filledBeads,
                          );
                          downloadBlob(
                            new Blob([csv], { type: "text/csv;charset=utf-8" }),
                            `color-stats-${selectedBrand}.csv`,
                          );
                        }}
                      >
                        用量 CSV
                      </button>
                    ) : null}
                  </div>
                  {!generationResult ? (
                    <p className="text-sm text-loom-on-surface-variant">
                      生成图纸后按用量排序列出。
                    </p>
                  ) : (
                    <div className="max-h-[min(42vh,360px)] overflow-y-auto pr-0.5">
                      <div className="grid grid-cols-6 gap-1.5">
                        {colorUsageStats.map((item) => {
                          const denom = Math.max(1, generationResult!.filledBeads);
                          const pct = (item.count / denom) * 100;
                          return (
                            <button
                              key={item.masterId}
                              type="button"
                              title={`${formatMasterOptionLabel(selectedBrand, item.masterId)} · ${item.count} 颗 (${pct.toFixed(1)}%)`}
                              className={cn(
                                "flex aspect-square min-h-0 w-full flex-col items-center justify-end rounded-md p-0.5 text-left ring-1 ring-loom-outline-variant/20 transition hover:ring-loom-primary-container/50",
                                selectedMasterColorId === item.masterId &&
                                  "ring-2 ring-loom-primary",
                              )}
                              style={{ backgroundColor: item.hex }}
                              onClick={() => setSelectedMasterColorId(item.masterId)}
                            >
                              <span
                                className="w-full truncate px-0.5 text-center font-mono text-[9px] font-bold leading-tight"
                                style={{
                                  color: labelTextColorForHex(item.hex),
                                  textShadow:
                                    labelTextColorForHex(item.hex) === "#ffffff"
                                      ? "0 0 2px rgba(0,0,0,0.5)"
                                      : "0 0 1px rgba(255,255,255,0.6)",
                                }}
                              >
                                {cellEditorDisplayCode(selectedBrand, item.masterId)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {generationResult ? (
                    <p className="mt-2 text-xs leading-relaxed text-loom-on-surface-variant">
                      网格 {generationResult.width}×{generationResult.height} 珠 · 已填{" "}
                      {generationResult.filledBeads} / {generationResult.totalBeads} 格
                    </p>
                  ) : null}
                </section>

                <section>
                  <p className="mb-2 text-xs font-bold text-loom-on-surface">批量替色</p>
                  <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-loom-outline-variant/15">
                    <p className="text-xs leading-relaxed text-loom-on-surface-variant">
                      将图纸中某一颜色批量替换为另一颜色（仅已出现在图纸中的色）。
                    </p>
                    {!generationResult ? (
                      <p className="mt-2 text-xs text-loom-on-surface-variant">生成图纸后可进行替色。</p>
                    ) : (
                      <>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div>
                            <p className="mb-0.5 text-[10px] font-medium text-loom-on-surface-variant">
                              源色
                            </p>
                            <ColorSwatchSelect
                              brand={selectedBrand}
                              items={colorUsageStats}
                              value={replaceSourceMasterId}
                              onChange={setReplaceSourceMasterId}
                              placeholder="选择源色"
                              getBrandCode={getBrandCode}
                            />
                          </div>
                          <div>
                            <p className="mb-0.5 text-[10px] font-medium text-loom-on-surface-variant">
                              目标色
                            </p>
                            <ColorSwatchSelect
                              brand={selectedBrand}
                              items={colorUsageStats}
                              value={replaceTargetMasterId}
                              onChange={setReplaceTargetMasterId}
                              placeholder="选择目标色"
                              getBrandCode={getBrandCode}
                            />
                          </div>
                        </div>
                        <p className="mt-2 text-[10px] text-loom-on-surface-variant">
                          匹配格数：
                          <strong className="text-loom-on-surface">{replaceMatchCount}</strong>
                        </p>
                        <button
                          type="button"
                          className="mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-loom-surface-container-highest loom-primary-gradient"
                          disabled={
                            !replaceSourceMasterId ||
                            !replaceTargetMasterId ||
                            replaceSourceMasterId === replaceTargetMasterId ||
                            replaceMatchCount === 0
                          }
                          onClick={handleApplyReplaceColor}
                        >
                          {replaceJustDone
                            ? "已替换"
                            : replaceSourceMasterId && replaceTargetMasterId
                              ? `替换 ${replaceMatchCount} 颗`
                              : "替换"}
                        </button>
                      </>
                    )}
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-xs font-bold text-loom-on-surface">缺色分析</p>
                  <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-loom-outline-variant/15">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-loom-on-surface">覆盖情况</span>
                      {missingColorAnalysis ? (
                        <button
                          type="button"
                          className="shrink-0 rounded-lg bg-loom-surface-low px-2.5 py-1.5 text-[11px] font-medium text-loom-on-surface ring-1 ring-loom-outline-variant/25 hover:bg-white"
                          onClick={() => {
                            const csv = buildMissingColorsCsv(selectedBrand, missingColorAnalysis);
                            downloadBlob(
                              new Blob([csv], { type: "text/csv;charset=utf-8" }),
                              `missing-colors-${selectedBrand}.csv`,
                            );
                          }}
                        >
                          缺色 CSV
                        </button>
                      ) : null}
                    </div>
                    {!missingColorAnalysis ? (
                      <p className="mt-2 text-xs text-loom-on-surface-variant">
                        生成图纸后显示相对当前颜色套装的覆盖与缺色。
                      </p>
                    ) : missingColorAnalysis.status === "fully-covered" ? (
                      <div className="mt-2 rounded-lg bg-loom-surface-low/90 px-3 py-2 text-xs text-loom-on-surface ring-1 ring-loom-outline-variant/25">
                        <p>当前套装可直接完成</p>
                        <p className="mt-1">
                          覆盖率：{(missingColorAnalysis.coverageRate * 100).toFixed(1)}%
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="mt-2 rounded-lg bg-loom-surface-low/90 px-3 py-2 text-xs text-loom-on-surface ring-1 ring-loom-outline-variant/25">
                          <p>
                            需补充 <strong>{missingColorAnalysis.missingColorCount}</strong> 色
                          </p>
                          <p className="mt-1">
                            覆盖率：{(missingColorAnalysis.coverageRate * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-0.5">
                          {missingColorAnalysis.missingItems.map((item) => (
                            <div
                              key={item.masterId}
                              className="rounded-lg bg-loom-surface-low/90 px-3 py-2 text-xs text-loom-on-surface ring-1 ring-loom-outline-variant/25"
                            >
                              <p className="text-sm font-semibold text-loom-on-surface">
                                {missingColorPrimaryTitle(
                                  selectedBrand,
                                  item.masterId,
                                  item.brandCode,
                                )}
                              </p>
                              <p className="mt-1">需求：{item.neededCount}</p>
                              <p className="mt-1 text-[11px] leading-snug text-loom-on-surface-variant">
                                其它品牌替代：{" "}
                                {formatAlternativesLine(item.masterId, selectedBrand)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </section>
              </div>

            <div className="shrink-0 border-t border-loom-outline-variant/15 bg-loom-surface-lowest/95 px-3 py-2.5 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.08)] lg:px-4">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-loom-on-surface-variant">
                导出
              </p>
              {inventoryHint ? (
                <div className="mb-2 flex gap-2 rounded-lg bg-orange-50 p-2 text-[10px] font-medium leading-snug text-orange-950 ring-1 ring-orange-200/60">
                  <span className="shrink-0" aria-hidden>
                    ⓘ
                  </span>
                  <span>{inventoryHint}</span>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!canExport}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition",
                    canExport
                      ? "bg-loom-surface-container-highest text-loom-on-surface hover:bg-loom-outline-variant/20"
                      : "cursor-not-allowed bg-loom-surface-container-high text-loom-on-surface-variant",
                  )}
                  onClick={() => void handleExportPng()}
                >
                  导出 PNG
                </button>
                <button
                  type="button"
                  disabled={!canExport}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold text-white transition",
                    canExport
                      ? "loom-primary-gradient hover:opacity-90"
                      : "cursor-not-allowed bg-loom-surface-container-high text-loom-on-surface-variant",
                  )}
                  onClick={() => void handleExportPdf()}
                >
                  导出 PDF
                </button>
              </div>
              {exportError ? (
                <p className="mt-1.5 text-[11px] text-rose-600">{exportError}</p>
              ) : null}
            </div>
            </div>
          </aside>
        </main>

        <SchemeComparisonDrawer
          open={schemeCompareOpen}
          onClose={() => setSchemeCompareOpen(false)}
          onApplied={(msg) => {
            setReplaceSourceMasterId(null);
            setReplaceTargetMasterId(null);
            setEditorToast(msg);
            window.setTimeout(() => setEditorToast(null), 2600);
          }}
        />

        <CustomPaletteDrawer
          open={customPaletteOpen}
          onClose={() => setCustomPaletteOpen(false)}
          brand={selectedBrand}
          initialSelection={customPaletteMasterIds}
          onApply={(ids) => {
            setCustomPaletteMasterIds(ids);
            if (customPreset) {
              applyPresetSelection(customPreset.id);
            } else {
              setSelectedTier("custom");
            }
            setEditorToast(`已应用自定义色板（${ids.length} 色）`);
            window.setTimeout(() => setEditorToast(null), 2400);
          }}
        />

        {editorToast ? (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl bg-loom-on-surface/90 px-4 py-2 text-center text-sm text-white shadow-lg"
          >
            {editorToast}
          </div>
        ) : null}
      </div>
    </div>
  );
}
