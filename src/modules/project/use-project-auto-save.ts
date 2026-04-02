"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildPersistFingerprint,
  getLastSavedFingerprint,
} from "@/modules/project/persist-fingerprint";
import { saveProject } from "@/modules/project/project-service";
import { useProjectStore } from "@/modules/project/store";

const THROTTLE_MS = 900;

export type ProjectSaveUiState = "saved" | "saving" | "unsaved";

/**
 * Debounced auto-save when a project id exists; surface save status in the shell.
 */
export function useProjectAutoSave() {
  const [status, setStatus] = useState<ProjectSaveUiState>("saved");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;

    const run = () => {
      const state = useProjectStore.getState();
      const fp = buildPersistFingerprint(state);
      const sid = state.currentProjectId;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (sid === null) {
        const dirty = Boolean(state.sourceImageFile || state.generationResult);
        if (alive) setStatus(dirty ? "unsaved" : "saved");
        return;
      }

      const last = getLastSavedFingerprint();
      if (last !== null && fp === last) {
        if (alive) setStatus("saved");
        return;
      }

      if (alive) setStatus("unsaved");
      timerRef.current = setTimeout(() => {
        void (async () => {
          if (!alive) return;
          setStatus("saving");
          try {
            await saveProject();
            if (alive) setStatus("saved");
          } catch {
            if (alive) setStatus("unsaved");
          }
        })();
      }, THROTTLE_MS);
    };

    run();
    const unsub = useProjectStore.subscribe(run);
    return () => {
      alive = false;
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return status;
}
