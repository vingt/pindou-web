"use client";

import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { SiteBrandLink } from "@/components/site-brand-link";
import { BrandSettingsProvider } from "@/contexts/brand-settings-context";
import { WorkspaceSaveProvider } from "@/contexts/workspace-save-context";
import { useProjectAutoSave } from "@/modules/project/use-project-auto-save";
import { useProjectStore } from "@/modules/project/store";
import { cn } from "@/lib/cn";

export default function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const saveStatus = useProjectAutoSave();
  const immersiveAssembly = useProjectStore((s) => s.immersiveAssembly);

  return (
    <BrandSettingsProvider>
      <WorkspaceSaveProvider status={saveStatus}>
        <div className="flex min-h-screen min-w-0 flex-col bg-loom-surface">
          <div
            className={cn(
              "sticky top-0 z-50 border-b border-loom-outline-variant/20 bg-loom-surface/90 loom-ambient-shadow backdrop-blur-xl supports-[backdrop-filter]:bg-loom-surface/80",
              immersiveAssembly && "hidden",
            )}
          >
            <div className="mx-auto flex min-h-14 w-full max-w-[min(100%,var(--workspace-max))] min-w-0 items-center justify-between gap-2 px-3 pt-[env(safe-area-inset-top,0px)] sm:min-h-16 sm:gap-3 sm:px-4 lg:px-6">
              <SiteBrandLink subtitle="工作区" className="min-w-0 shrink" />
              <AppNav variant="compact" className="min-w-0 shrink" />
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </WorkspaceSaveProvider>
    </BrandSettingsProvider>
  );
}
