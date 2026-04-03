"use client";

import { create } from "zustand";
import type {
  BrandId,
  BrandPresetId,
  GenerationConfig,
  GenerationMode,
  MissingColorAnalysis,
  OptimizationConfig,
  PatternCell,
  PatternGenerationResult,
  PresetTier,
  ProcessingMode,
} from "@/types";
import {
  DEFAULT_OPTIMIZATION_CONFIG,
  DEFAULT_TARGET_GRID_HEIGHT,
  DEFAULT_TARGET_GRID_WIDTH,
} from "@/types/project";
import { optimizationPresetForProcessingMode } from "@/modules/pattern/services/optimization-presets";
import {
  clearUserOptimizationPreference,
  loadUserOptimizationPreference,
  saveUserOptimizationPreference,
} from "@/modules/project/persist-user-optimization";
import { getActiveBrandSettingsBundle } from "@/modules/brand-settings/runtime";
import {
  findFirstEnabledPresetForTier,
  findPresetById,
  getEnabledNumericTierPresetsForBrand,
} from "@/modules/brand-settings/selectors";

export type ActiveTool =
  | "select"
  | "brush"
  | "eraser"
  | "repair"
  | "eyedropper";

const MAX_EDITOR_HISTORY = 50;

function cloneCells(cells: PatternCell[][]): PatternCell[][] {
  return cells.map((row) => row.map((cell) => ({ ...cell })));
}

export type ProjectUiState = {
  selectedBrand: BrandId;
  selectedPresetId: BrandPresetId;
  selectedGenerationMode: GenerationMode;
  selectedTier: PresetTier;
  compareOriginal: boolean;
  sourceImageFile: File | null;
  sourceImageUrl: string | null;
  sourceImageWidth: number | null;
  sourceImageHeight: number | null;
  generationResult: PatternGenerationResult | null;
  missingColorAnalysis: MissingColorAnalysis | null;
  /** Last successful generate / export config; kept in sync with imports. */
  lastGeneratedConfig: GenerationConfig | null;
  /** 高级生成选项（与下次生成、无 lastGeneratedConfig 时的导出摘要共用）。 */
  optimization: OptimizationConfig;
  /** 底板目标网格（珠），写入 GenerationConfig。 */
  targetGridWidth: number;
  targetGridHeight: number;
  /** Local persistence session (IndexedDB / localStorage). */
  currentProjectId: string | null;
  currentProjectName: string;
  projectCreatedAt: string | null;
  zoom: number;
  activeTool: ActiveTool;
  selectedMasterColorId: string | null;
  historyStack: PatternCell[][][];
  redoStack: PatternCell[][][];
  /** 上次「生成图纸」成功后的 cells 快照；用于一键重置编辑。 */
  baselineCells: PatternCell[][] | null;
  /** `tier === "custom"` 时使用；存 MARD 主色编号。 */
  customPaletteMasterIds: string[];
  /** 沉浸逐色拼装：隐藏工作区顶栏与画布工具栏，专注底板。 */
  immersiveAssembly: boolean;
  /** 沉浸模式下高亮的色号（null = 显示全部且不暗化）。 */
  immersiveFocusMasterId: string | null;
  setCustomPaletteMasterIds: (ids: string[]) => void;
  setImmersiveAssembly: (value: boolean) => void;
  setImmersiveFocusMasterId: (value: string | null) => void;
  setSelectedBrand: (value: BrandId) => void;
  setSelectedPresetId: (value: BrandPresetId) => void;
  /** Select a preset row from settings (keeps tier + presetId in sync). */
  applyPresetSelection: (presetId: BrandPresetId) => void;
  setSelectedGenerationMode: (value: GenerationMode) => void;
  setSelectedTier: (value: PresetTier) => void;
  setCompareOriginal: (value: boolean) => void;
  setTargetGridWidth: (value: number) => void;
  setTargetGridHeight: (value: number) => void;
  setSourceImage: (payload: {
    file: File | null;
    url: string | null;
    width: number | null;
    height: number | null;
  }) => void;
  setGenerationResult: (value: PatternGenerationResult | null) => void;
  setEditedGenerationResult: (value: PatternGenerationResult) => void;
  setMissingColorAnalysis: (value: MissingColorAnalysis | null) => void;
  setLastGeneratedConfig: (value: GenerationConfig | null) => void;
  setOptimization: (value: Partial<OptimizationConfig>) => void;
  applyProcessingModePreset: (mode: ProcessingMode) => void;
  /** 恢复 DEFAULT_OPTIMIZATION_CONFIG，并清除本机记住的高级选项 */
  resetOptimizationToStandard: () => void;
  setProjectSession: (payload: {
    id: string;
    name: string;
    createdAt: string;
  }) => void;
  /** 编辑中的项目名（与保存/序列化共用）。 */
  setCurrentProjectName: (value: string) => void;
  resetWorkspace: () => void;
  setZoom: (value: number) => void;
  setActiveTool: (value: ActiveTool) => void;
  setSelectedMasterColorId: (value: string | null) => void;
  pushHistorySnapshot: (cells: PatternCell[][]) => void;
  pushRedoSnapshot: (cells: PatternCell[][]) => void;
  popUndoSnapshot: () => PatternCell[][] | null;
  popRedoSnapshot: () => PatternCell[][] | null;
  clearRedoStack: () => void;
  clearEditorHistory: () => void;
};

function toPresetId(brand: BrandId, tier: PresetTier): BrandPresetId {
  const bundle = getActiveBrandSettingsBundle();
  if (tier === "custom") {
    const row = bundle.presets.find(
      (p) => p.brandId === brand && p.tier === "custom" && p.isEnabled,
    );
    return (row?.id ?? `${brand}_custom`) as BrandPresetId;
  }
  const row = findFirstEnabledPresetForTier(brand, tier, bundle);
  if (row) return row.id as BrandPresetId;
  const numeric = getEnabledNumericTierPresetsForBrand(brand, bundle);
  const fallback = numeric[numeric.length - 1];
  return (fallback?.id ?? `${brand}_${tier}`) as BrandPresetId;
}

export const useProjectStore = create<ProjectUiState>((set) => ({
  selectedBrand: "mard",
  selectedPresetId: "mard_221",
  selectedGenerationMode: "strict-preset",
  selectedTier: 221,
  compareOriginal: false,
  sourceImageFile: null,
  sourceImageUrl: null,
  sourceImageWidth: null,
  sourceImageHeight: null,
  generationResult: null,
  missingColorAnalysis: null,
  lastGeneratedConfig: null,
  optimization: { ...DEFAULT_OPTIMIZATION_CONFIG },
  targetGridWidth: DEFAULT_TARGET_GRID_WIDTH,
  targetGridHeight: DEFAULT_TARGET_GRID_HEIGHT,
  currentProjectId: null,
  currentProjectName: "未命名项目",
  projectCreatedAt: null,
  zoom: 1,
  activeTool: "select",
  selectedMasterColorId: null,
  historyStack: [],
  redoStack: [],
  baselineCells: null,
  customPaletteMasterIds: [],
  immersiveAssembly: false,
  immersiveFocusMasterId: null,
  setCustomPaletteMasterIds: (ids) => set({ customPaletteMasterIds: [...new Set(ids)] }),
  setImmersiveAssembly: (value) =>
    set({
      immersiveAssembly: value,
      ...(value ? {} : { immersiveFocusMasterId: null }),
    }),
  setImmersiveFocusMasterId: (value) => set({ immersiveFocusMasterId: value }),
  setSelectedBrand: (value) =>
    set((state) => ({
      selectedBrand: value,
      selectedPresetId: toPresetId(value, state.selectedTier),
    })),
  setSelectedPresetId: (value) => set({ selectedPresetId: value }),
  applyPresetSelection: (presetId) =>
    set((state) => {
      const preset = findPresetById(presetId);
      if (!preset || preset.brandId !== state.selectedBrand || !preset.isEnabled) {
        return state;
      }
      return {
        selectedPresetId: presetId,
        selectedTier: preset.tier as PresetTier,
      };
    }),
  setSelectedGenerationMode: (value) => set({ selectedGenerationMode: value }),
  setSelectedTier: (value) =>
    set((state) => ({
      selectedTier: value,
      selectedPresetId: toPresetId(state.selectedBrand, value),
    })),
  setCompareOriginal: (value) => set({ compareOriginal: value }),
  setTargetGridWidth: (value) =>
    set({
      targetGridWidth: Math.max(8, Math.min(500, Math.floor(value) || DEFAULT_TARGET_GRID_WIDTH)),
    }),
  setTargetGridHeight: (value) =>
    set({
      targetGridHeight: Math.max(8, Math.min(500, Math.floor(value) || DEFAULT_TARGET_GRID_HEIGHT)),
    }),
  setSourceImage: (payload) =>
    set({
      sourceImageFile: payload.file,
      sourceImageUrl: payload.url,
      sourceImageWidth: payload.width,
      sourceImageHeight: payload.height,
      generationResult: null,
      missingColorAnalysis: null,
      selectedMasterColorId: null,
      historyStack: [],
      redoStack: [],
      lastGeneratedConfig: null,
      baselineCells: null,
      immersiveAssembly: false,
      immersiveFocusMasterId: null,
    }),
  setGenerationResult: (value) =>
    set({
      generationResult: value,
      selectedMasterColorId: value?.usedMasterIds[0] ?? null,
      historyStack: [],
      redoStack: [],
      ...(value === null
        ? {
            lastGeneratedConfig: null,
            baselineCells: null,
            immersiveAssembly: false,
            immersiveFocusMasterId: null,
          }
        : {}),
    }),
  setEditedGenerationResult: (value) => set({ generationResult: value }),
  setMissingColorAnalysis: (value) => set({ missingColorAnalysis: value }),
  setLastGeneratedConfig: (value) => set({ lastGeneratedConfig: value }),
  setOptimization: (value) =>
    set((state) => {
      const optimization = { ...state.optimization, ...value };
      saveUserOptimizationPreference(optimization);
      return { optimization };
    }),
  applyProcessingModePreset: (mode) =>
    set(() => {
      const optimization = optimizationPresetForProcessingMode(mode);
      saveUserOptimizationPreference(optimization);
      return { optimization };
    }),
  resetOptimizationToStandard: () =>
    set(() => {
      clearUserOptimizationPreference();
      return { optimization: { ...DEFAULT_OPTIMIZATION_CONFIG } };
    }),
  setProjectSession: (payload) =>
    set({
      currentProjectId: payload.id,
      currentProjectName: payload.name,
      projectCreatedAt: payload.createdAt,
    }),
  setCurrentProjectName: (value) => set({ currentProjectName: value }),
  resetWorkspace: () =>
    set((state) => {
      if (state.sourceImageUrl) {
        try {
          URL.revokeObjectURL(state.sourceImageUrl);
        } catch {
          /* ignore */
        }
      }
      const optimization =
        loadUserOptimizationPreference() ?? { ...DEFAULT_OPTIMIZATION_CONFIG };
      return {
        sourceImageFile: null,
        sourceImageUrl: null,
        sourceImageWidth: null,
        sourceImageHeight: null,
        generationResult: null,
        missingColorAnalysis: null,
        lastGeneratedConfig: null,
        optimization,
        targetGridWidth: DEFAULT_TARGET_GRID_WIDTH,
        targetGridHeight: DEFAULT_TARGET_GRID_HEIGHT,
        currentProjectId: null,
        currentProjectName: "未命名项目",
        projectCreatedAt: null,
        selectedMasterColorId: null,
        historyStack: [],
        redoStack: [],
        baselineCells: null,
        customPaletteMasterIds: [],
        immersiveAssembly: false,
        immersiveFocusMasterId: null,
      };
    }),
  setZoom: (value) => set({ zoom: value }),
  setActiveTool: (value) =>
    set({
      activeTool: (value as string) === "replace-color" ? "brush" : value,
    }),
  setSelectedMasterColorId: (value) => set({ selectedMasterColorId: value }),
  pushHistorySnapshot: (cells) =>
    set((state) => ({
      historyStack: [...state.historyStack, cloneCells(cells)].slice(
        -MAX_EDITOR_HISTORY,
      ),
    })),
  pushRedoSnapshot: (cells) =>
    set((state) => ({
      redoStack: [...state.redoStack, cloneCells(cells)].slice(-MAX_EDITOR_HISTORY),
    })),
  popUndoSnapshot: () => {
    let snapshot: PatternCell[][] | null = null;
    set((state) => {
      if (state.historyStack.length === 0) return state;
      snapshot = cloneCells(state.historyStack[state.historyStack.length - 1]);
      return { historyStack: state.historyStack.slice(0, -1) };
    });
    return snapshot;
  },
  popRedoSnapshot: () => {
    let snapshot: PatternCell[][] | null = null;
    set((state) => {
      if (state.redoStack.length === 0) return state;
      snapshot = cloneCells(state.redoStack[state.redoStack.length - 1]);
      return { redoStack: state.redoStack.slice(0, -1) };
    });
    return snapshot;
  },
  clearRedoStack: () => set({ redoStack: [] }),
  clearEditorHistory: () => set({ historyStack: [], redoStack: [] }),
}));
