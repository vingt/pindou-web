"use client";

import {
  DEFAULT_OPTIMIZATION_CONFIG,
  type OptimizationConfig,
} from "@/types";

const STORAGE_KEY = "bead-user-optimization:v1";

/**
 * 读取本机保存的高级生成选项；无数据或解析失败时返回 null（使用应用内 DEFAULT）。
 */
export function loadUserOptimizationPreference(): OptimizationConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OptimizationConfig>;
    if (!parsed || typeof parsed !== "object") return null;
    return { ...DEFAULT_OPTIMIZATION_CONFIG, ...parsed };
  } catch {
    return null;
  }
}

export function saveUserOptimizationPreference(opt: OptimizationConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opt));
  } catch {
    /* quota / 隐私模式 */
  }
}

export function clearUserOptimizationPreference(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
