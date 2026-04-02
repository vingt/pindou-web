"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ProjectSaveUiState } from "@/modules/project/use-project-auto-save";

const WorkspaceSaveContext = createContext<ProjectSaveUiState>("saved");

export function WorkspaceSaveProvider({
  status,
  children,
}: {
  status: ProjectSaveUiState;
  children: ReactNode;
}) {
  return (
    <WorkspaceSaveContext.Provider value={status}>
      {children}
    </WorkspaceSaveContext.Provider>
  );
}

export function useWorkspaceSaveStatus(): ProjectSaveUiState {
  return useContext(WorkspaceSaveContext);
}
