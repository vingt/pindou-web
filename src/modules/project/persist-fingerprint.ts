"use client";

import type { ProjectUiState } from "@/modules/project/store";

/** Stable string for dirty-check / post-save baseline (excludes zoom, tool, undo stacks). */
export function buildPersistFingerprint(state: ProjectUiState): string {
  return JSON.stringify({
    gr: state.generationResult,
    miss: state.missingColorAnalysis,
    lastCfg: state.lastGeneratedConfig,
    ui: {
      brand: state.selectedBrand,
      presetId: state.selectedPresetId,
      mode: state.selectedGenerationMode,
      tier: state.selectedTier,
      compare: state.compareOriginal,
      gridW: state.targetGridWidth,
      gridH: state.targetGridHeight,
      customKit: state.customPaletteMasterIds,
    },
    opt: state.optimization,
    src: {
      w: state.sourceImageWidth,
      h: state.sourceImageHeight,
      fn: state.sourceImageFile?.name ?? null,
      size: state.sourceImageFile?.size ?? null,
    },
    pid: state.currentProjectId,
    pname: state.currentProjectName,
    pcreated: state.projectCreatedAt,
  });
}

let lastSavedFingerprint: string | null = null;

export function getLastSavedFingerprint(): string | null {
  return lastSavedFingerprint;
}

export function setLastSavedFingerprint(fp: string | null) {
  lastSavedFingerprint = fp;
}
