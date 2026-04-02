import { BRAND_ID_SAFE_REGEX } from "./schema";

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 10);
}

function normalizeSlugBase(displayName: string): string {
  const trimmed = displayName.trim();
  let base = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) {
    base = `brand${simpleHash(trimmed)}`;
  }
  if (!/^[a-z]/.test(base)) {
    base = `b${simpleHash(trimmed)}`;
  }
  return base.slice(0, 40);
}

/**
 * Derives a unique `brand.id` from user-facing name (lowercase, safe chars, schema-valid).
 */
export function generateBrandIdFromDisplayName(
  displayName: string,
  existingIds: ReadonlySet<string>,
): string {
  const base = normalizeSlugBase(displayName);
  let id = base;
  let n = 2;
  while (existingIds.has(id) || !BRAND_ID_SAFE_REGEX.test(id)) {
    const suffix = `_${n}`;
    id = `${base.slice(0, Math.max(1, 40 - suffix.length))}${suffix}`;
    n += 1;
    if (n > 9999) {
      id = `brand${simpleHash(displayName + n)}`;
      break;
    }
  }
  if (!BRAND_ID_SAFE_REGEX.test(id)) {
    id = `b${simpleHash(displayName)}`.slice(0, 40);
    let m = 2;
    while (existingIds.has(id)) {
      id = `b${simpleHash(displayName + m)}`.slice(0, 40);
      m += 1;
    }
  }
  return id;
}
