"use client";

import { buildExportPatternPayload } from "./build-export-payload";
import { buildPatternExportBasename } from "./export-filename";
import { downloadBlob } from "./download-blob";
import { exportPatternPdf } from "./build-pattern-pdf";
import { exportPatternPng } from "./render-pattern-png";
import type { ExportPatternPayload } from "@/types/export";
import type { GenerationConfig, PatternProject } from "@/types";
import { normalizeGenerationConfig } from "@/types/project";

function sanitizeProjectFileStem(name: string): string {
  const s = name.trim() || "pattern";
  return s.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "-").slice(0, 96);
}

export function buildExportPayloadFromPatternProject(
  project: PatternProject,
): ExportPatternPayload | null {
  if (!project.generationResult) return null;
  const generationConfig = normalizeGenerationConfig(
    project.generationConfig as GenerationConfig,
  );
  const src = project.sourceImage;
  return buildExportPatternPayload({
    generationConfig,
    generationResult: project.generationResult,
    missingColorAnalysis: project.missingColorAnalysis,
    sourceImage:
      src && src.width > 0
        ? {
            width: src.width,
            height: src.height,
            fileName: src.fileName,
          }
        : null,
  });
}

export async function downloadPatternExportForProject(
  project: PatternProject,
  format: "png" | "pdf",
): Promise<void> {
  const payload = buildExportPayloadFromPatternProject(project);
  if (!payload) throw new Error("尚未生成图纸");
  const stem = sanitizeProjectFileStem(project.name);
  const part = buildPatternExportBasename(
    payload.generationConfig.brand,
    payload.generationConfig.tier,
    payload.generationResult.width,
    payload.generationResult.height,
  );
  const filename = format === "png" ? `${stem}_${part}.png` : `${stem}_${part}.pdf`;
  const blob =
    format === "png" ? await exportPatternPng(payload) : await exportPatternPdf(payload);
  await downloadBlob(blob, filename);
}
