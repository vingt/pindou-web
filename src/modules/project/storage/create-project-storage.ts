import { createIndexedDbProjectStorage } from "./indexeddb-adapter";
import { createLocalStorageProjectStorage } from "./localstorage-adapter";
import type { ProjectStorageAdapter } from "./types";

/**
 * Prefer IndexedDB; fall back to localStorage for MVP resilience.
 */
export async function createProjectStorage(): Promise<ProjectStorageAdapter> {
  if (typeof indexedDB === "undefined") {
    return createLocalStorageProjectStorage();
  }
  try {
    const adapter = createIndexedDbProjectStorage();
    await adapter.listRecent(1);
    return adapter;
  } catch {
    return createLocalStorageProjectStorage();
  }
}

let cached: Promise<ProjectStorageAdapter> | null = null;

export function getProjectStorageSingleton(): Promise<ProjectStorageAdapter> {
  if (!cached) cached = createProjectStorage();
  return cached;
}
