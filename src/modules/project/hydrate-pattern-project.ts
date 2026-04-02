"use client";

import { useProjectStore } from "@/modules/project/store";
import { saveUserOptimizationPreference } from "@/modules/project/persist-user-optimization";
import { dataUrlToFile } from "@/modules/project/serialize-project";
import type {
  BrandPresetId,
  GenerationConfig,
  PatternCell,
  PatternGenerationResult,
  PatternProject,
} from "@/types";
import { normalizeGenerationConfig } from "@/types/project";
import type { PatternProjectParsed } from "@/modules/project/schema/pattern-project-schema";

function cloneCells(cells: PatternCell[][]): PatternCell[][] {
  return cells.map((row) => row.map((cell) => ({ ...cell })));
}

function safeRevoke(url: string | null) {
  if (!url || !url.startsWith("blob:")) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

/**
 * Apply validated PatternProject into the editor store (object URL + optional File).
 */
export async function hydratePatternProjectIntoStore(
  project: PatternProject | PatternProjectParsed,
): Promise<void> {
  const prevUrl = useProjectStore.getState().sourceImageUrl;
  safeRevoke(prevUrl);

  let file: File | null = null;
  let url: string | null = null;
  const { imageDataUrl, fileName, width, height, mimeType } = project.sourceImage;
  if (imageDataUrl) {
    file = await dataUrlToFile(
      imageDataUrl,
      fileName ?? "source.png",
      mimeType ?? null,
    );
    url = URL.createObjectURL(file);
  }

  const generationConfig = normalizeGenerationConfig(
    project.generationConfig as GenerationConfig,
  );

  saveUserOptimizationPreference(generationConfig.optimization);

  useProjectStore.setState({
    selectedBrand: generationConfig.brand,
    selectedPresetId: generationConfig.presetId as BrandPresetId,
    selectedGenerationMode: generationConfig.generationMode,
    selectedTier: generationConfig.tier,
    compareOriginal: generationConfig.compareOriginal,
    targetGridWidth: generationConfig.targetGridWidth,
    targetGridHeight: generationConfig.targetGridHeight,
    optimization: generationConfig.optimization,
    sourceImageFile: file,
    sourceImageUrl: url,
    sourceImageWidth: width,
    sourceImageHeight: height,
    generationResult: project.generationResult as PatternGenerationResult | null,
    missingColorAnalysis: project.missingColorAnalysis,
    lastGeneratedConfig: generationConfig,
    currentProjectId: project.id,
    currentProjectName: project.name,
    projectCreatedAt: project.createdAt,
    selectedMasterColorId: project.generationResult?.usedMasterIds[0] ?? null,
    historyStack: [],
    redoStack: [],
    activeTool: "select",
    baselineCells: project.generationResult
      ? cloneCells((project.generationResult as PatternGenerationResult).cells)
      : null,
    customPaletteMasterIds:
      generationConfig.tier === "custom"
        ? (generationConfig.customPaletteMasterIds ?? [])
        : [],
  });
}
