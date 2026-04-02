"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteProject,
  exportStoredProjectPattern,
  getProjectSourcePreviewDataUrl,
  listRecentProjects,
  loadProject,
  renameProject,
} from "@/modules/project/project-service";
import type { PatternProjectListEntry } from "@/modules/project/storage/types";
import { cn } from "@/lib/cn";

function formatCardTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`;
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 15V3" />
      <path d="m17 10-5 5-5-5" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </svg>
  );
}

function ProjectCardPreview({ projectId }: { projectId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getProjectSourcePreviewDataUrl(projectId)
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className="absolute inset-0 bg-loom-surface-container-high">
      {loading ? (
        <div className="h-full w-full animate-pulse bg-loom-surface-container-highest/70" aria-hidden />
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL previews from stored projects
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-loom-on-surface-variant">
          无预览
        </div>
      )}
    </div>
  );
}

export function ProjectsView() {
  const router = useRouter();
  const [recentProjects, setRecentProjects] = useState<PatternProjectListEntry[]>(
    [],
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const refreshRecent = useCallback(async () => {
    try {
      setRecentProjects(await listRecentProjects(30));
    } catch {
      setRecentProjects([]);
    }
  }, []);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    const onRefresh = () => void refreshRecent();
    window.addEventListener("bead-recent-refresh", onRefresh);
    return () => window.removeEventListener("bead-recent-refresh", onRefresh);
  }, [refreshRecent]);

  useEffect(() => {
    if (!selectMode) setSelectedIds([]);
  }, [selectMode]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAll = () => setSelectedIds(recentProjects.map((p) => p.id));
  const clearSelection = () => setSelectedIds([]);

  const handleOpenAndGoEditor = async (id: string) => {
    setErrorMessage(null);
    setOpeningId(id);
    try {
      await loadProject(id);
      router.push("/editor");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "打开失败");
    } finally {
      setOpeningId(null);
    }
  };

  const handleDeleteRecent = async (id: string) => {
    if (!window.confirm("确定删除该本地项目？此操作不可恢复。")) return;
    setErrorMessage(null);
    try {
      await deleteProject(id);
      await refreshRecent();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleRename = (row: PatternProjectListEntry) => {
    const next = window.prompt("项目名称", row.name);
    if (next === null) return;
    setErrorMessage(null);
    void (async () => {
      try {
        await renameProject(row.id, next);
        await refreshRecent();
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "重命名失败");
      }
    })();
  };

  const handleExportOne = async (id: string, format: "png" | "pdf") => {
    setErrorMessage(null);
    try {
      await exportStoredProjectPattern(id, format);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "导出失败";
      setErrorMessage(msg.includes("尚未生成") ? "该项目尚未生成图纸，无法导出。" : msg);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(`确定删除所选 ${selectedIds.length} 个项目？此操作不可恢复。`)
    ) {
      return;
    }
    setErrorMessage(null);
    setBatchBusy(true);
    try {
      for (const id of selectedIds) {
        await deleteProject(id);
      }
      clearSelection();
      setSelectMode(false);
      await refreshRecent();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBatchBusy(false);
    }
  };

  const handleBatchExport = async (format: "png" | "pdf") => {
    if (selectedIds.length === 0) return;
    setErrorMessage(null);
    setBatchBusy(true);
    let failed = 0;
    try {
      for (const id of selectedIds) {
        try {
          await exportStoredProjectPattern(id, format);
        } catch {
          failed += 1;
        }
        await new Promise((r) => window.setTimeout(r, 450));
      }
      if (failed > 0) {
        setErrorMessage(
          `${failed} 个项目无法导出（可能尚未生成图纸），其余已开始下载。`,
        );
      }
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 bg-transparent px-4 pb-16 pt-6 text-loom-on-surface md:px-8">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5">
        <header className="mb-2 space-y-2 md:mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-loom-on-surface md:text-3xl">
            创作历史
          </h1>
          <p className="text-sm text-loom-on-surface-variant md:text-base">
            {selectMode
              ? "点击卡片可多选；使用下方操作栏批量删除或导出。"
              : "您的项目都保存在本机，点击卡片或「打开」进入编辑器。"}
          </p>
          {errorMessage ? (
            <p className="text-sm text-rose-600" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </header>

        {recentProjects.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-loom-outline-variant/15 bg-loom-surface-lowest/90 px-4 py-3 ring-1 ring-loom-outline-variant/10">
            <button
              type="button"
              disabled={batchBusy}
              onClick={() => setSelectMode((v) => !v)}
              className="rounded-full bg-loom-surface-container-high px-3 py-1.5 text-xs font-medium text-loom-on-surface ring-1 ring-loom-outline-variant/20 transition hover:bg-loom-surface-container-highest disabled:opacity-50"
            >
              {selectMode ? "完成选择" : "批量选择"}
            </button>
            {selectMode ? (
              <>
                <button
                  type="button"
                  disabled={batchBusy}
                  onClick={selectAll}
                  className="rounded-full bg-loom-surface-lowest px-3 py-1.5 text-xs font-medium text-loom-on-surface-variant ring-1 ring-loom-outline-variant/25 hover:bg-loom-surface-low disabled:opacity-50"
                >
                  全选
                </button>
                <button
                  type="button"
                  disabled={batchBusy}
                  onClick={clearSelection}
                  className="rounded-full bg-loom-surface-lowest px-3 py-1.5 text-xs font-medium text-loom-on-surface-variant ring-1 ring-loom-outline-variant/25 hover:bg-loom-surface-low disabled:opacity-50"
                >
                  取消全选
                </button>
                <span className="text-xs text-loom-on-surface-variant">
                  已选 {selectedIds.length} 项
                </span>
                <span className="hidden h-4 w-px bg-loom-outline-variant/30 sm:inline" aria-hidden />
                <button
                  type="button"
                  disabled={batchBusy || selectedIds.length === 0}
                  onClick={() => void handleBatchDelete()}
                  className="rounded-full bg-loom-surface-lowest px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200/60 hover:bg-rose-50 disabled:opacity-40"
                >
                  删除所选
                </button>
                <button
                  type="button"
                  disabled={batchBusy || selectedIds.length === 0}
                  onClick={() => void handleBatchExport("png")}
                  className="rounded-full bg-loom-surface-lowest px-3 py-1.5 text-xs font-medium text-loom-primary ring-1 ring-loom-primary/20 hover:bg-loom-surface-low disabled:opacity-40"
                >
                  导出 PNG
                </button>
                <button
                  type="button"
                  disabled={batchBusy || selectedIds.length === 0}
                  onClick={() => void handleBatchExport("pdf")}
                  className="rounded-full bg-loom-surface-lowest px-3 py-1.5 text-xs font-medium text-loom-primary ring-1 ring-loom-primary/20 hover:bg-loom-surface-low disabled:opacity-40"
                >
                  导出 PDF
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {recentProjects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-loom-outline-variant/30 bg-loom-surface-low/40 px-6 py-14 text-center text-sm text-loom-on-surface-variant">
            暂无记录。在编辑器中保存项目后，会出现在这里。
          </p>
        ) : (
          <ul className="grid list-none grid-cols-1 gap-8 p-0 md:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((row) => {
              const busy = openingId === row.id;
              const selected = selectedSet.has(row.id);
              const cardOpensEditor = !selectMode;
              const cardFocusable = selectMode || cardOpensEditor;

              return (
                <li key={row.id}>
                  <div
                    role={cardFocusable ? "button" : undefined}
                    tabIndex={cardFocusable ? 0 : undefined}
                    aria-busy={busy}
                    aria-pressed={selectMode ? selected : undefined}
                    aria-label={
                      selectMode
                        ? `${selected ? "取消选择" : "选择"} ${row.name}`
                        : `打开项目 ${row.name}`
                    }
                    onClick={() => {
                      if (selectMode) {
                        toggleSelect(row.id);
                        return;
                      }
                      if (!busy) void handleOpenAndGoEditor(row.id);
                    }}
                    onKeyDown={(e) => {
                      if (selectMode) {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSelect(row.id);
                        }
                        return;
                      }
                      if (busy) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void handleOpenAndGoEditor(row.id);
                      }
                    }}
                    className={cn(
                      "group flex cursor-pointer flex-col overflow-hidden rounded-xl bg-loom-surface-lowest text-left shadow-[0_24px_48px_-12px_rgba(11,28,48,0.04)] transition-all hover:shadow-[0_24px_48px_-12px_rgba(11,28,48,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-loom-primary-container",
                      selected
                        ? "ring-2 ring-loom-primary ring-offset-2 ring-offset-loom-surface"
                        : "ring-1 ring-loom-outline-variant/10",
                    )}
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-loom-surface-container-low">
                      <ProjectCardPreview projectId={row.id} />
                      {selectMode ? (
                        <div className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-loom-outline-variant/25">
                          <input
                            type="checkbox"
                            readOnly
                            checked={selected}
                            tabIndex={-1}
                            className="h-4 w-4 rounded border-loom-outline-variant/40 text-loom-primary"
                            aria-hidden
                          />
                        </div>
                      ) : null}
                      {!selectMode && busy ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm font-medium text-loom-on-surface-variant backdrop-blur-[2px]">
                          打开中…
                        </div>
                      ) : null}
                    </div>
                    <div className="p-6 md:p-8">
                      <h3 className="mb-1 line-clamp-2 text-xl font-bold text-loom-on-surface">
                        {row.name}
                      </h3>
                      <p className="flex items-center gap-1.5 text-sm text-loom-on-surface-variant">
                        <ClockIcon className="size-3.5 shrink-0 opacity-70" />
                        <span>{formatCardTime(row.updatedAt)}</span>
                      </p>
                      {!selectMode ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2 pt-2">
                          <button
                            type="button"
                            disabled={busy}
                            className="loom-primary-gradient min-w-0 flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleOpenAndGoEditor(row.id);
                            }}
                          >
                            打开
                          </button>
                          <button
                            type="button"
                            title="导出 PNG"
                            disabled={busy}
                            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-loom-surface-low text-loom-on-surface-variant transition hover:bg-loom-surface-container-high disabled:opacity-40"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleExportOne(row.id, "png");
                            }}
                          >
                            <DownloadIcon className="size-4" />
                            <span className="sr-only">导出 PNG</span>
                          </button>
                          <button
                            type="button"
                            title="导出 PDF"
                            disabled={busy}
                            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-loom-surface-low text-loom-on-surface-variant transition hover:bg-loom-surface-container-high disabled:opacity-40"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleExportOne(row.id, "pdf");
                            }}
                          >
                            <span className="text-[10px] font-bold">PDF</span>
                            <span className="sr-only">导出 PDF</span>
                          </button>
                          <button
                            type="button"
                            title="重命名"
                            disabled={busy}
                            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-loom-surface-low text-loom-primary transition hover:bg-loom-surface-container-high disabled:opacity-40"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRename(row);
                            }}
                          >
                            <PencilIcon className="size-4" />
                            <span className="sr-only">重命名</span>
                          </button>
                          <button
                            type="button"
                            title="删除"
                            disabled={busy}
                            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-loom-surface-low text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteRecent(row.id);
                            }}
                          >
                            <TrashIcon className="size-4" />
                            <span className="sr-only">删除</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
            {!selectMode ? (
              <li>
                <Link
                  href="/editor"
                  className="flex min-h-[22rem] flex-col items-center justify-center rounded-xl border-4 border-dashed border-loom-outline-variant/30 bg-loom-surface-low/30 p-8 text-center transition hover:border-loom-primary/40 hover:bg-loom-surface-low/50"
                >
                  <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-loom-surface-container-high text-2xl text-loom-primary transition-transform group-hover:scale-110">
                    +
                  </div>
                  <h3 className="text-xl font-bold text-loom-on-surface">新建图纸</h3>
                  <p className="mt-2 max-w-[14rem] text-sm text-loom-on-surface-variant">
                    在编辑器中上传图片并生成拼豆图纸
                  </p>
                  <span className="loom-primary-gradient mt-6 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm">
                    前往编辑器
                  </span>
                </Link>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
