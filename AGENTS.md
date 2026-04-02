# AGENTS

## Frozen Core Rules

1. MARD 221 is the only master mother palette in this system.
2. Internal pattern cells, color references, and editing results must use `masterColorId` only.
3. Other brands are mapping layers only and never replace the master palette model.
4. Preset/tier availability is represented by `availableMasterIds` subsets.
5. Missing mapping values must be stored as `null` and rendered as `×` in UI.
6. Naming convention: UI text uses `MARD 221`; internal ids use `mard221`.

## Delivery Discipline

1. Keep one task per commit and avoid unrelated changes.
2. Avoid cross-module refactors unless explicitly requested.
3. Do not implement complex logic before requirements are requested and scoped.
4. In Phase 0, keep behavior as placeholders with stable types and structure.

## Brand-first Display Rule (Global)

This project uses MARD only as the internal canonical master palette and mapping key.

### Internal rule
- `masterColorId` may use the MARD code internally for:
  - quantization
  - mapping
  - statistics
  - export payloads
  - cross-brand lookup

### UI rule
- The UI must always use the **currently selected brand** as the primary display brand.
- If the user selects COCO, then COCO color codes are the primary visible color codes.
- If the user selects 卡卡, then 卡卡 color codes are the primary visible color codes.
- MARD must NOT be shown as the primary visible color code unless the current selected brand is MARD.

### Missing-color rule
- Missing color cards must primarily show the missing color code in the currently selected brand.
- Other brands are shown only as alternatives.
- In the alternative list, MARD should appear first.

### Avoid this mistake
Do NOT expose MARD codes as the default front-end display just because they are internal master keys.
MARD is an internal anchor, not the default UI display language.
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
