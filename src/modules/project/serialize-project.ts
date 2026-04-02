import { PATTERN_PROJECT_FORMAT_VERSION } from "@/modules/project/schema/pattern-project-schema";
import type { ProjectUiState } from "@/modules/project/store";
import { normalizeGenerationConfig } from "@/types/project";
import type { GenerationConfig, PatternProject, ProjectSourceImageMeta } from "@/types";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read file failed"));
    reader.readAsDataURL(file);
  });
}

function resolveGenerationConfig(state: ProjectUiState): GenerationConfig {
  const live = {
    brand: state.selectedBrand,
    tier: state.selectedTier,
    presetId: state.selectedPresetId,
    generationMode: state.selectedGenerationMode,
    compareOriginal: state.compareOriginal,
    targetGridWidth: state.targetGridWidth,
    targetGridHeight: state.targetGridHeight,
    optimization: state.optimization,
    customPaletteMasterIds: state.customPaletteMasterIds,
  };
  if (state.lastGeneratedConfig) {
    return normalizeGenerationConfig({
      ...state.lastGeneratedConfig,
      ...live,
    });
  }
  return normalizeGenerationConfig(live);
}

export async function buildSourceImageMeta(state: ProjectUiState): Promise<ProjectSourceImageMeta> {
  const { sourceImageFile, sourceImageWidth, sourceImageHeight } = state;
  const w = sourceImageWidth ?? 0;
  const h = sourceImageHeight ?? 0;
  if (!sourceImageFile) {
    return {
      fileName: null,
      width: w,
      height: h,
      mimeType: null,
      imageDataUrl: null,
    };
  }
  const imageDataUrl = await readFileAsDataUrl(sourceImageFile);
  return {
    fileName: sourceImageFile.name,
    width: w || (state.generationResult?.sourceImageWidth ?? 0),
    height: h || (state.generationResult?.sourceImageHeight ?? 0),
    mimeType: sourceImageFile.type || null,
    imageDataUrl,
  };
}

export type SerializePatternProjectParams = {
  state: ProjectUiState;
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: Date;
};

/**
 * Extract JSON-serializable PatternProject from current store slice + identity fields.
 */
export async function serializePatternProject(
  params: SerializePatternProjectParams,
): Promise<PatternProject> {
  const { state, id, name, createdAt } = params;
  const updatedAt = (params.updatedAt ?? new Date()).toISOString();
  const sourceImage = await buildSourceImageMeta(state);
  return {
    version: PATTERN_PROJECT_FORMAT_VERSION,
    id,
    name,
    createdAt,
    updatedAt,
    sourceImage,
    generationConfig: resolveGenerationConfig(state),
    generationResult: state.generationResult,
    missingColorAnalysis: state.missingColorAnalysis,
  };
}

export async function dataUrlToFile(
  dataUrl: string,
  fileName: string,
  mimeType?: string | null,
): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const type = mimeType && mimeType.length > 0 ? mimeType : blob.type || "image/png";
  return new File([blob], fileName || "source.png", { type });
}
