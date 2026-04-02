"use client";

import { deserializeProjectJson } from "@/modules/project/deserialize-project";
import { hydratePatternProjectIntoStore } from "@/modules/project/hydrate-pattern-project";
import {
  buildPersistFingerprint,
  setLastSavedFingerprint,
} from "@/modules/project/persist-fingerprint";
import { serializePatternProject } from "@/modules/project/serialize-project";
import { getProjectStorageSingleton } from "@/modules/project/storage/create-project-storage";
import { useProjectStore } from "@/modules/project/store";
import { downloadBlob } from "@/modules/export/download-blob";
import { downloadPatternExportForProject } from "@/modules/export/export-pattern-from-project";
import type { PatternProject } from "@/types";

export async function saveProject(): Promise<void> {
  const state = useProjectStore.getState();
  const id = state.currentProjectId ?? crypto.randomUUID();
  const createdAt = state.projectCreatedAt ?? new Date().toISOString();
  const name = state.currentProjectName.trim() || "未命名项目";
  const project = await serializePatternProject({
    state,
    id,
    name,
    createdAt,
  });
  const storage = await getProjectStorageSingleton();
  await storage.put(project);
  useProjectStore.setState({
    currentProjectId: id,
    projectCreatedAt: createdAt,
    currentProjectName: name,
  });
  setLastSavedFingerprint(buildPersistFingerprint(useProjectStore.getState()));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bead-recent-refresh"));
  }
}

export async function saveProjectAs(name: string): Promise<void> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  useProjectStore.setState({
    currentProjectId: id,
    projectCreatedAt: createdAt,
    currentProjectName: name.trim() || "未命名项目",
  });
  await saveProject();
}

export async function loadProject(projectId: string): Promise<void> {
  const storage = await getProjectStorageSingleton();
  const row = await storage.get(projectId);
  if (!row) throw new Error("找不到该项目");
  await hydratePatternProjectIntoStore(row);
  setLastSavedFingerprint(buildPersistFingerprint(useProjectStore.getState()));
}

/** For UI thumbnails on the projects list; does not mutate the editor store. */
export async function getProjectSourcePreviewDataUrl(
  projectId: string,
): Promise<string | null> {
  const storage = await getProjectStorageSingleton();
  const row = await storage.get(projectId);
  const url = row?.sourceImage?.imageDataUrl;
  return typeof url === "string" && url.length > 0 ? url : null;
}

export async function deleteProject(projectId: string): Promise<void> {
  const storage = await getProjectStorageSingleton();
  await storage.remove(projectId);
  const state = useProjectStore.getState();
  if (state.currentProjectId === projectId) {
    setLastSavedFingerprint(null);
    state.resetWorkspace();
  }
}

export async function listRecentProjects(limit = 20) {
  const storage = await getProjectStorageSingleton();
  return storage.listRecent(limit);
}

export async function renameProject(projectId: string, newName: string): Promise<void> {
  const storage = await getProjectStorageSingleton();
  const project = await storage.get(projectId);
  if (!project) throw new Error("找不到该项目");
  const name = newName.trim() || "未命名项目";
  const updated: PatternProject = {
    ...project,
    name,
    updatedAt: new Date().toISOString(),
  };
  await storage.put(updated);
  const state = useProjectStore.getState();
  if (state.currentProjectId === projectId) {
    useProjectStore.setState({ currentProjectName: name });
    setLastSavedFingerprint(buildPersistFingerprint(useProjectStore.getState()));
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bead-recent-refresh"));
  }
}

/** 从本地存储读取并导出图纸（PNG / PDF），不修改当前编辑器状态。 */
export async function exportStoredProjectPattern(
  projectId: string,
  format: "png" | "pdf",
): Promise<void> {
  const storage = await getProjectStorageSingleton();
  const project = await storage.get(projectId);
  if (!project) throw new Error("找不到该项目");
  await downloadPatternExportForProject(project, format);
}

export async function serializeProject(): Promise<PatternProject> {
  const state = useProjectStore.getState();
  const id = state.currentProjectId ?? `draft-${Date.now()}`;
  const createdAt = state.projectCreatedAt ?? new Date().toISOString();
  const name = state.currentProjectName.trim() || "未命名项目";
  return serializePatternProject({ state, id, name, createdAt });
}

/** Wire-format JSON string (pretty-printed). */
export async function exportProjectJson(): Promise<string> {
  const project = await serializeProject();
  return `${JSON.stringify(project, null, 2)}\n`;
}

export async function exportProjectJsonFile(): Promise<void> {
  const json = await exportProjectJson();
  const state = useProjectStore.getState();
  const base = (state.currentProjectName.trim() || "pattern-project").replace(
    /\s+/g,
    "-",
  );
  downloadBlob(
    new Blob([json], { type: "application/json;charset=utf-8" }),
    `${base}.pattern.json`,
  );
}

export async function importProjectJson(
  file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = await file.text();
  const parsed = deserializeProjectJson(text);
  if (!parsed.ok) return parsed;
  try {
    await hydratePatternProjectIntoStore(parsed.project);
    setLastSavedFingerprint(buildPersistFingerprint(useProjectStore.getState()));
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "导入失败",
    };
  }
}
