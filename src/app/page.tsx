import type { Metadata } from "next";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { SiteBrandLink } from "@/components/site-brand-link";

export const metadata: Metadata = {
  title: "拼豆图纸生成器 — 从照片到可拼图纸",
  description:
    "支持多品牌色板与套装，生成拼豆底板网格，编辑、缺色分析与导出图纸。",
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-loom-surface text-loom-on-surface">
      <header className="fixed top-0 z-50 w-full border-b border-loom-outline-variant/20 bg-loom-surface/90 backdrop-blur-xl supports-[backdrop-filter]:bg-loom-surface/85">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <SiteBrandLink subtitle="照片 → 网格 → 导出" size="lg" />
          <AppNav className="order-3 w-full justify-center lg:order-none lg:w-auto" />
          <Link
            href="/editor"
            className="loom-primary-gradient shrink-0 rounded-full px-5 py-2 text-sm font-semibold text-white transition active:scale-[0.98] hover:opacity-90"
          >
            立即开始
          </Link>
        </div>
      </header>

      <main className="flex-1 pt-[5.5rem] sm:pt-20 lg:pt-16">
        <section
          className="relative overflow-hidden px-4 py-16 sm:px-8 sm:py-24 md:py-32 lg:py-40"
          aria-labelledby="hero-heading"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 loom-bead-pattern opacity-[0.12]" />
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-100/90 px-4 py-2 text-sm font-medium text-[#4f46e5] ring-1 ring-sky-200/60">
                <span aria-hidden>✦</span>
                浏览器内完成，数据主要保存在本机
              </div>
              <h1
                id="hero-heading"
                className="font-[var(--font-manrope)] text-4xl font-black leading-[1.08] tracking-tight text-[#111827] sm:text-5xl lg:text-6xl xl:text-7xl"
              >
                <span className="block">从照片到拼豆，</span>
                <span className="block">从未如此简单</span>
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-[#6b7280] md:text-xl">
                选择拼豆品牌与套装色板，生成底板网格；支持编辑、沉浸逐色拼装、缺色统计与
                PDF/PNG 导出，对照实作更省心。
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/editor"
                  className="flex items-center gap-2 rounded-full bg-[#4f46e5] px-8 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-[#4338ca] hover:shadow-xl active:scale-[0.98]"
                >
                  进入编辑器
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  href="/projects"
                  className="rounded-full bg-[#dbeafe] px-8 py-4 text-lg font-bold text-[#1e3a5f] transition hover:bg-[#bfdbfe]"
                >
                  创作历史
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -right-6 -top-6 -z-10 size-32 rotate-12 rounded-[2rem] bg-loom-secondary-container/80" />
              <div className="absolute -bottom-8 -left-8 -z-10 size-48 rounded-full bg-loom-primary-fixed-dim/50" />
              <div className="relative z-10 overflow-hidden rounded-[2rem] border-4 border-white loom-ambient-shadow">
                <div className="flex aspect-[4/3] flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-white to-indigo-50/80 px-8 text-center">
                  <p className="text-sm font-medium text-[#374151]">
                    上传照片并生成后，此处为图纸预览
                  </p>
                  <p className="mt-2 font-mono text-xs font-medium text-[#4f46e5]">
                    52×39 · 多品牌色号
                  </p>
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-[#111827]/88 px-6 py-5 text-white backdrop-blur-[2px]">
                  <p className="text-xs font-medium text-white/80">工作流</p>
                  <p className="mt-0.5 font-bold leading-snug">上传 → 选套装 → 生成 → 导出</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="bg-loom-surface-low px-4 py-20 sm:px-8"
          aria-labelledby="features-heading"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 space-y-3 text-center sm:mb-16">
              <h2
                id="features-heading"
                className="font-[var(--font-manrope)] text-3xl font-black tracking-tight text-loom-on-surface md:text-4xl"
              >
                为实作准备的工具
              </h2>
              <p className="mx-auto max-w-2xl text-loom-on-surface-variant">
                以 MARD 221 为主色母本，各品牌映射展示色号；网格内始终可对齐你手上的豆子。
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
              <div className="group flex flex-col justify-between rounded-[2rem] bg-loom-surface-lowest p-8 transition-shadow hover:loom-ambient-shadow md:col-span-8 md:p-10">
                <div className="max-w-md space-y-4">
                  <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-loom-primary/10 text-2xl text-loom-primary">
                    ◎
                  </div>
                  <h3 className="text-2xl font-bold text-loom-on-surface">多品牌色板</h3>
                  <p className="leading-relaxed text-loom-on-surface-variant">
                    按品牌与套装选择可用主色集合；格内色号随当前品牌显示，映射缺失时标为 ×。
                  </p>
                </div>
                <div className="mt-8 flex gap-2">
                  <span className="size-10 rounded-full bg-red-400/90" />
                  <span className="size-10 rounded-full bg-teal-400/90" />
                  <span className="size-10 rounded-full bg-amber-300/90" />
                  <span className="size-10 rounded-full bg-slate-700/90" />
                </div>
              </div>
              <div className="flex flex-col justify-between rounded-[2rem] bg-loom-primary p-8 text-white md:col-span-4 md:p-10">
                <div className="space-y-4">
                  <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/20 text-2xl">
                    ▦
                  </div>
                  <h3 className="text-2xl font-bold">底板与生成</h3>
                  <p className="leading-relaxed text-white/80">
                    自定义宽高珠数；处理模式与抖动可选，生成可编辑的像素网格。
                  </p>
                </div>
                <div className="mt-8 rounded-xl border border-white/20 p-4">
                  <div className="grid grid-cols-6 gap-1.5">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className={`aspect-square rounded-sm ${i % 2 === 0 ? "bg-white/35" : "bg-white/15"}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-[2rem] bg-loom-secondary-container p-8 md:col-span-4 md:p-10">
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-white text-xl text-loom-secondary">
                  ◉
                </div>
                <h3 className="text-2xl font-bold text-loom-on-surface">沉浸拼装</h3>
                <p className="mt-3 leading-relaxed text-loom-on-secondary-container">
                  逐色高亮画布，其余变淡；配合上一色/下一色，大批量同色拼装不易错格。
                </p>
              </div>
              <div className="flex flex-col gap-8 rounded-[2rem] bg-loom-surface-lowest p-8 transition-shadow hover:loom-ambient-shadow md:col-span-8 md:flex-row md:items-center md:p-10">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-loom-secondary-fixed text-xl text-loom-primary">
                    ≡
                  </div>
                  <h3 className="text-2xl font-bold text-loom-on-surface">缺色、统计与导出</h3>
                  <p className="leading-relaxed text-loom-on-surface-variant">
                    对照当前套装看覆盖与缺色；表格查看各色用量；导出带色号的 PNG/PDF。
                  </p>
                </div>
                <div className="w-full rounded-2xl border border-loom-outline-variant/30 bg-loom-surface p-4 md:w-1/3">
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-rose-500" />
                        示例色 A
                      </span>
                      <span className="font-bold">120 颗</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-loom-surface-container">
                      <div className="h-full w-[65%] bg-rose-500" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-blue-500" />
                        示例色 B
                      </span>
                      <span className="font-bold">48 颗</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-loom-surface-container">
                      <div className="h-full w-[30%] bg-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden px-4 py-20 sm:px-8">
          <div
            className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#3525cd] via-[#4338ca] to-[#4f46e5] px-6 py-14 text-center shadow-xl shadow-indigo-900/20 md:px-16 md:py-16"
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl"
              aria-hidden
            />
            <div className="relative z-10">
              <h2 className="mb-4 font-[var(--font-manrope)] text-3xl font-black text-white md:text-4xl">
                准备好开始一张图纸了吗？
              </h2>
              <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/90">
                无需安装，在浏览器中即可完成上传、生成与编辑。项目可保存到创作历史，下次继续。
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
                <Link
                  href="/editor"
                  className="inline-flex min-w-[12rem] items-center justify-center rounded-full bg-white px-10 py-4 text-lg font-bold text-[#4f46e5] shadow-md transition hover:bg-sky-50"
                >
                  进入编辑器
                </Link>
                <Link
                  href="/projects"
                  className="inline-flex min-w-[12rem] items-center justify-center rounded-full border-2 border-white/80 bg-white/15 px-10 py-4 text-lg font-bold text-white shadow-sm backdrop-blur-sm transition hover:border-white hover:bg-white/25"
                >
                  打开创作历史
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-loom-outline-variant/20 bg-loom-surface py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 text-center sm:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-xs text-loom-on-surface-variant">
            <span className="hover:text-loom-primary">使用条款（待补充）</span>
            <span className="hover:text-loom-primary">隐私政策（待补充）</span>
            <Link href="/settings" className="hover:text-loom-primary">
              设置
            </Link>
          </div>
          <p className="text-xs text-loom-on-surface-variant/80">
            © {new Date().getFullYear()} 拼豆图纸生成器
          </p>
        </div>
      </footer>
    </div>
  );
}
