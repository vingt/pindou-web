"use client";

import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { SiteBrandLink } from "@/components/site-brand-link";
import { BrandSettingsProvider } from "@/contexts/brand-settings-context";
import { WorkspaceSaveProvider } from "@/contexts/workspace-save-context";
import { useProjectAutoSave } from "@/modules/project/use-project-auto-save";

export default function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const saveStatus = useProjectAutoSave();

  return (
    <BrandSettingsProvider>
      <WorkspaceSaveProvider status={saveStatus}>
        <div className="flex min-h-screen flex-col bg-loom-surface">
          <div className="sticky top-0 z-50 h-16 border-b border-loom-outline-variant/20 bg-loom-surface/90 loom-ambient-shadow backdrop-blur-xl supports-[backdrop-filter]:bg-loom-surface/80">
            <div className="mx-auto flex h-full w-full max-w-[1680px] items-center justify-between gap-4 px-4 lg:px-6">
              <SiteBrandLink subtitle="工作区" />
              <AppNav variant="compact" />
            </div>
          </div>
          <div className="flex-1">{children}</div>
        </div>
      </WorkspaceSaveProvider>
    </BrandSettingsProvider>
  );
}
