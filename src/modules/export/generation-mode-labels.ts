import type { GenerationMode } from "@/types";

const LABELS: Record<GenerationMode, string> = {
  "strict-preset": "严格套装",
  "allow-refill": "允许补色",
};

export function getGenerationModeLabel(mode: GenerationMode): string {
  return LABELS[mode];
}
