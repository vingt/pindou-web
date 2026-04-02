import type { PatternProject } from "@/types";
import type { PatternProjectListEntry, ProjectStorageAdapter } from "./types";

const INDEX_KEY = "bead-pattern-project-index-v1";

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

function rowKey(id: string) {
  return `bead-pattern-project:${id}`;
}

function toListEntry(p: PatternProject): PatternProjectListEntry {
  return {
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt,
    brand: p.generationConfig.brand,
    tier: p.generationConfig.tier,
    width: p.generationResult?.width ?? null,
    height: p.generationResult?.height ?? null,
  };
}

/** MVP fallback when IndexedDB is unavailable (e.g. some privacy modes). */
export function createLocalStorageProjectStorage(): ProjectStorageAdapter {
  return {
    async put(project: PatternProject) {
      const ids = readIndex().filter((x) => x !== project.id);
      ids.unshift(project.id);
      writeIndex(ids);
      localStorage.setItem(rowKey(project.id), JSON.stringify(project));
    },

    async get(id: string) {
      const raw = localStorage.getItem(rowKey(id));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as PatternProject;
      } catch {
        return null;
      }
    },

    async remove(id: string) {
      localStorage.removeItem(rowKey(id));
      writeIndex(readIndex().filter((x) => x !== id));
    },

    async listRecent(limit = 30) {
      const ids = readIndex();
      const projects: PatternProject[] = [];
      for (const id of ids) {
        const raw = localStorage.getItem(rowKey(id));
        if (!raw) continue;
        try {
          projects.push(JSON.parse(raw) as PatternProject);
        } catch {
          /* skip corrupt row */
        }
      }
      projects.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      return projects.slice(0, limit).map(toListEntry);
    },
  };
}
