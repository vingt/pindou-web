import {
  deserializeProjectUnknown,
  type DeserializeProjectResult,
} from "@/modules/project/schema/pattern-project-schema";
import type { PatternProject } from "@/types";

export type { DeserializeProjectResult };

/** Parse JSON text then validate with zod + version rules. */
export function deserializeProjectJson(text: string): DeserializeProjectResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "文件不是有效的 JSON。" };
  }
  return deserializeProjectUnknown(data);
}

/** Validate an already-parsed JSON value. */
export function deserializeProject(data: unknown): DeserializeProjectResult {
  return deserializeProjectUnknown(data);
}

export function assertPatternProject(data: unknown): PatternProject {
  const r = deserializeProjectUnknown(data);
  if (!r.ok) throw new Error(r.error);
  return r.project as PatternProject;
}
