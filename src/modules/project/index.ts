/**
 * Project persistence API (Phase 8).
 * Prefer importing from here for stable surface area.
 */
export {
  deserializeProject,
  deserializeProjectJson,
} from "@/modules/project/deserialize-project";
export { hydratePatternProjectIntoStore } from "@/modules/project/hydrate-pattern-project";
export {
  buildPersistFingerprint,
  getLastSavedFingerprint,
  setLastSavedFingerprint,
} from "@/modules/project/persist-fingerprint";
export {
  deleteProject,
  exportProjectJson,
  exportProjectJsonFile,
  importProjectJson,
  listRecentProjects,
  loadProject,
  saveProject,
  saveProjectAs,
  serializeProject,
} from "@/modules/project/project-service";
export { serializePatternProject } from "@/modules/project/serialize-project";
export {
  PATTERN_PROJECT_FORMAT_VERSION,
  PatternProjectSchema,
  SUPPORTED_PATTERN_PROJECT_VERSIONS,
  deserializeProjectUnknown,
} from "@/modules/project/schema/pattern-project-schema";
export { getProjectStorageSingleton } from "@/modules/project/storage/create-project-storage";
export type {
  PatternProjectListEntry,
  ProjectStorageAdapter,
} from "@/modules/project/storage/types";
export { useProjectStore } from "@/modules/project/store";
export { useProjectAutoSave } from "@/modules/project/use-project-auto-save";
