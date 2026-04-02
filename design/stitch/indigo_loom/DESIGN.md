# Design System Documentation: The Tactile Artisan

## 1. Overview & Creative North Star: "The Digital Loom"
This design system moves away from the sterile, rigid nature of traditional software to embrace a "Digital Loom" aesthetic. For a Bead Pattern Generator, the UI must feel as tactile and intentional as the craft itself. We achieve this through **Soft Minimalism**: a high-end editorial approach that prioritizes breathing room, expansive radii, and tonal depth over structural lines. 

The goal is to provide a "Curated Workspace" where the tool fades into the background, leaving the user’s vibrant bead patterns to take center stage. We replace the "boxiness" of standard web apps with fluid, nested surfaces and sophisticated Indigo-to-Slate transitions.

---

## 2. Colors: Tonal Architecture
We utilize a Material-based palette to create a sense of professional authority mixed with creative calm.

### The "No-Line" Rule
Traditional 1px borders are strictly prohibited for defining sections. Layout boundaries must be established through **Background Color Shifts**. For example, a `surface-container-low` workspace should sit directly atop a `surface` background. The eye should perceive change through value, not outlines.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. 
*   **Base:** `surface` (#f8f9ff)
*   **Secondary Zones (Sidebars):** `surface-container-low` (#eff4ff)
*   **Active Elements (Cards):** `surface-container-lowest` (#ffffff)
*   **Nested Modals/Popovers:** `surface-bright` (#f8f9ff)

### The Glass & Signature Textures
To elevate the "Professional Tool" feel, use **Glassmorphism** for floating toolbars (e.g., bead pickers). Use `surface-container-lowest` at 80% opacity with a `backdrop-filter: blur(20px)`. Main Action Buttons should utilize a subtle linear gradient: `primary` (#3525cd) to `primary_container` (#4f46e5) at a 135-degree angle to provide a "gem-like" depth.

---

## 3. Typography: Editorial Clarity
We pair **Inter** for numerals and English UI strings with **Noto Sans SC** for Chinese characters. The hierarchy is designed to feel like a high-end craft magazine.

*   **Display & Headlines:** Use `display-md` for pattern titles. Keep letter-spacing tight (-0.02em) to maintain a premium, customized look.
*   **Functional Text:** `body-md` is the workhorse. Ensure `on_surface_variant` (#464555) is used for secondary metadata to maintain a soft contrast that reduces eye strain during long design sessions.
*   **Labels:** Use `label-md` in all-caps for sidebar headers, with a slight tracking increase (+0.05em) to differentiate them from interactive text.

---

## 4. Elevation & Depth: Tonal Layering
We avoid "floating" everything. Depth is earned through a sophisticated stacking of our surface tokens.

*   **The Layering Principle:** Instead of shadows, place a `surface-container-lowest` card on a `surface-container-high` background. This "inward" depth creates a modern, recessed look.
*   **Ambient Shadows:** Where lift is required (e.g., a floating color palette), use a custom shadow: `0 24px 48px -12px rgba(11, 28, 48, 0.08)`. The shadow color is derived from `on_surface`, ensuring it looks like natural light hitting a matte surface.
*   **The Ghost Border:** If high-precision containment is needed (e.g., the bead grid itself), use the "Ghost Border": `outline_variant` (#c7c4d8) at **20% opacity**. Never use 100% opaque borders.

---

## 5. Components

### Sidebar Navigation
*   **Container:** `surface-container-low` with a right "Ghost Border."
*   **Active State:** No heavy background blocks. Use a `primary` vertical "pill" indicator (4px width) on the left and transition the text color to `primary`.

### Form Controls & Inputs
*   **Input Fields:** Use `surface-container-lowest`. Radius must be `lg` (2rem). The border is a `Ghost Border` that transitions to `primary` (2px) only on focus.
*   **Checkboxes/Radios:** Use the `primary` color for checked states. The "unselected" state should be a soft `surface-container-highest` circle to avoid visual clutter.

### The Bead Grid (Custom Component)
*   **Bead Cells:** Use `DEFAULT` (1rem) or `sm` (0.5rem) rounding depending on bead type. 
*   **Grid Separators:** No lines. Use a 2px gap (Spacing Scale `0.5`) to allow the `surface-container-high` background to peek through, creating a natural grid.

### Cards & Lists
*   **Card Style:** Use `surface-container-lowest` with `xl` (3rem) corner radius for pattern previews.
*   **No-Divider Rule:** Forbid 1px dividers between list items. Use Spacing Scale `4` (1.4rem) to separate items, or alternating tonal backgrounds (`surface` vs `surface-container-low`).

### Buttons
*   **Primary:** Gradient-filled (Indigo), `full` radius (pill-shaped).
*   **Secondary:** `surface-container-highest` background with `on_surface` text. No border.
*   **Tertiary:** Text-only, using `primary` color for the label.

---

## 6. Do’s and Don’ts

### Do
*   **DO** use whitespace as a functional tool to group related bead settings.
*   **DO** use the `xl` (3rem) and `lg` (2rem) radii generously to maintain the "Soft Minimalist" feel.
*   **DO** ensure that Chinese typography has a slightly higher line-height (1.6) than English to maintain legibility in Noto Sans SC.

### Don’t
*   **DON’T** use pure black (#000) for text. Always use `on_surface` (#0b1c30) for a softer, more professional Indigo-Slate harmony.
*   **DON’T** use standard 4px or 8px rounding. This system requires the "oversized" feel of `2xl` to distinguish itself as a high-end tool.
*   **DON’T** use shadows on buttons. Let the gradient and the large radius provide the "clickability" affordance.