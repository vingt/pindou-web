# Stitch 导出（5 页）

来源：用户提供的 `stitch.zip`，已解压到此目录，便于对照实现与给 AI 读源码。

## 页面对照

| 文件夹 | 设计稿内容 | 应对产品路由 |
|--------|------------|----------------|
| `_1/` | **沉浸拼装**全屏画布顶栏（上一色/下一色、调色板、退出等） | `/editor` 沉浸子状态（非独立路由） |
| `_2/` | **落地页**（`title`: 拼豆图纸生成器 - 专业手工设计工具） | `/` |
| `_3/` | **三栏编辑器**（`title`: 编辑器 - 拼豆图纸生成器） | `/editor` |
| `_4/` | **创作历史**列表 | `/projects` |
| `_5/` | **设置**（含 Tab、恢复默认） | `/settings` |

## 文件说明

- **`code.html`**：Tailwind CDN + 内联 `tailwind.config` 颜色/圆角。可直接搜 `#[0-9a-fA-F]{6}` 取色，或整段复制 `theme.extend.colors`。
- ~~**`screen.png`**~~：原 Stitch 截图已移出仓库以减小体积；布局以 `code.html` 与已实现页面为准。
- **`indigo_loom/DESIGN.md`**：设计系统文字说明（Digital Loom / 无硬边框 / 大圆角 / 主色渐变等）。

## 与实现的关系

Next 项目使用 **Tailwind v4**（`@theme` / `globals.css`），**不能**直接粘贴 CDN 版 `tailwind.config`；需要把色板与圆角 **映射成** `tokens.css` 或 `@theme` 变量，再在组件里用 `bg-[var(--…)]` 或扩展后的类名。

**已实现（代码侧）**：`globals.css` 中 `@theme` 的 `loom-*` 色板；`tokens.css` 中的 `.loom-primary-gradient`、`.loom-glass`、`.loom-ambient-shadow`、`.loom-bead-pattern`。落地页、工作区顶栏、`AppNav`、`SiteBrandLink`、编辑器外壳、创作历史、设置页顶区已按该体系调整；设置子 Tab 内容区仍为原组件样式，可后续再细调。

文案与功能以 **`docs/phase-1-ui-ux-brief.md`** 与真实代码为准；Stitch 里错误品牌名、多余搜索框等应忽略或改掉。

## 核心色板（从各 `code.html` 提取，便于手抄）

- 页面底 `background` / `surface`：`#f8f9ff`
- 侧栏/浅区 `surface-container-low`：`#eff4ff`
- 卡片白 `surface-container-lowest`：`#ffffff`
- 主色 `primary`：`#3525cd`，`primary-container`：`#4f46e5`
- 主按钮渐变：`linear-gradient(135deg, #3525cd, #4f46e5)`
- 主文字 `on-surface`：`#0b1c30`
- 次文字 `on-surface-variant`：`#464555`
- 幽灵边 `outline-variant`：`#c7c4d8`（常用 20% 透明度）
- 环境阴影：`0 24px 48px -12px rgba(11, 28, 48, 0.08)`

圆角：`DEFAULT` 1rem，`lg` 2rem，`xl` 3rem，`full` pill。
