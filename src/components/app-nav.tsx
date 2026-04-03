"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** 飞书多维表格 · 使用反馈 */
export const FEEDBACK_FORM_URL =
  "https://xtool.feishu.cn/share/base/form/shrcnEBsBiARV8HII1Z7nI2Y9Gh";

/** 与落地页、工作区顶栏共用 */
export const WORKSPACE_NAV_LINKS = [
  { href: "/", label: "首页" },
  { href: "/editor", label: "编辑器" },
  { href: "/projects", label: "创作历史" },
  { href: "/settings", label: "设置" },
] as const;

function linkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AppNavProps = {
  className?: string;
  /** 落地页用宽松间距；工作区可传紧凑 */
  variant?: "default" | "compact";
};

export function AppNav({ className, variant = "default" }: AppNavProps) {
  const pathname = usePathname();
  const gap = variant === "compact" ? "gap-0.5 sm:gap-1" : "gap-2 sm:gap-6";
  const linkPad =
    variant === "compact"
      ? "shrink-0 min-h-11 items-center px-2 py-2 text-xs sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-sm"
      : "px-3 py-1.5";

  return (
    <nav
      className={cn(
        "flex max-w-full items-center font-medium tracking-tight text-sm touch-manipulation",
        variant === "compact"
          ? "flex-nowrap overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex-wrap",
        gap,
        className,
      )}
      aria-label="主导航"
    >
      {WORKSPACE_NAV_LINKS.map((item) => {
        const active = linkActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "transition-colors",
              linkPad,
              active
                ? "border-b-2 border-loom-primary font-bold text-loom-primary"
                : "rounded-lg text-loom-on-surface-variant hover:bg-loom-surface-low hover:text-loom-primary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
      <a
        href={FEEDBACK_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "shrink-0 rounded-lg text-loom-on-surface-variant transition-colors hover:bg-loom-surface-low hover:text-loom-primary",
          linkPad,
        )}
      >
        使用反馈
      </a>
    </nav>
  );
}
