import type { PatternProject } from "@/types";
import type { PatternProjectListEntry, ProjectStorageAdapter } from "./types";

const DB_NAME = "bead-pattern-projects-v1";
const DB_VERSION = 1;
const STORE = "projects";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
    req.onsuccess = () => resolve(req.result);
  });
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

export function createIndexedDbProjectStorage(): ProjectStorageAdapter {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => {
    if (!dbPromise) dbPromise = openDb();
    return dbPromise;
  };

  return {
    async put(project: PatternProject) {
      const database = await db();
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(STORE, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("tx failed"));
        tx.onabort = () => reject(tx.error ?? new Error("tx aborted"));
        tx.objectStore(STORE).put(project);
      });
    },

    async get(id: string) {
      const database = await db();
      const tx = database.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const row = await idbRequest(store.get(id));
      return (row as PatternProject | undefined) ?? null;
    },

    async remove(id: string) {
      const database = await db();
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(STORE, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("tx failed"));
        tx.objectStore(STORE).delete(id);
      });
    },

    async listRecent(limit = 30) {
      const database = await db();
      const tx = database.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const all = await idbRequest(store.getAll());
      const projects = all as PatternProject[];
      projects.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      return projects.slice(0, limit).map(toListEntry);
    },
  };
}
