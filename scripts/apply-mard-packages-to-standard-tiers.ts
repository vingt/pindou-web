/**
 * Applies `src/data/presets/mard-package-layout.json` to `standard-tiers.json`
 * for tiers 24/48/72/96/120/144/216/264. Tier 221 is left unchanged.
 *
 * 盼盼（panpan）无独立套装布局：内置预设直接复用本文件产出的标准档 ∩ `panpan.mapping.json`。
 *
 * Tiers 120/144/216/264: groups may intentionally repeat ids across groups; we dedupe in
 * encounter order, then pad with remaining master ids (+ extension keys) in
 * canonical order until the tier size matches.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Layout = {
  groups: Record<string, string[]>;
  packages: Record<
    string,
    { use_groups?: string[]; codes?: string[]; exclude?: string[] }
  >;
};

function assertLen(tier: string, ids: string[], expected: number) {
  if (ids.length !== expected) {
    throw new Error(`Tier ${tier}: expected ${expected} ids, got ${ids.length}`);
  }
}

function assertNoDup(ids: string[], tier: string) {
  const s = new Set<string>();
  for (const id of ids) {
    if (s.has(id)) {
      throw new Error(`Tier ${tier}: duplicate id ${id}`);
    }
    s.add(id);
  }
}

function dedupeConcatGroups(
  groups: Record<string, string[]>,
  names: string[],
  exclude?: string[],
): string[] {
  const ex = new Set(exclude ?? []);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const list = groups[n];
    if (!list?.length) {
      throw new Error(`Missing group: ${n}`);
    }
    for (const id of list) {
      if (ex.has(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function padToLength(
  base: string[],
  targetLen: number,
  fillCandidates: string[],
  tier: string,
): string[] {
  const seen = new Set(base);
  const out = [...base];
  for (const id of fillCandidates) {
    if (out.length >= targetLen) break;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  if (out.length !== targetLen) {
    throw new Error(
      `Tier ${tier}: after pad got ${out.length}, need ${targetLen} (fill pool exhausted?)`,
    );
  }
  return out;
}

async function main() {
  const root = process.cwd();
  const layoutPath = path.join(root, "src/data/presets/mard-package-layout.json");
  const tiersPath = path.join(root, "src/data/presets/standard-tiers.json");
  const masterPath = path.join(root, "src/data/palettes/mard221.master.json");
  const extPath = path.join(root, "src/data/palettes/extension-color-overrides.json");

  const layout = JSON.parse(await readFile(layoutPath, "utf-8")) as Layout;
  const { groups, packages } = layout;

  const masterList = (JSON.parse(await readFile(masterPath, "utf-8")) as { id: string }[]).map(
    (r) => r.id,
  );
  const extKeys = Object.keys(JSON.parse(await readFile(extPath, "utf-8")) as Record<string, unknown>);
  const fillPool = [...masterList, ...extKeys.sort((a, b) => a.localeCompare(b))];

  const t24 = packages["24色"]?.codes;
  const t48 = packages["48色"]?.codes;
  const t72 = packages["72色"]?.codes;
  const t96 = packages["96色"]?.codes;
  if (!t24 || !t48 || !t72 || !t96) {
    throw new Error("24/48/72/96 packages must include codes[]");
  }
  assertNoDup(t24, "24");
  assertNoDup(t48, "48");
  assertNoDup(t72, "72");
  assertNoDup(t96, "96");
  assertLen("24", t24, 24);
  assertLen("48", t48, 48);
  assertLen("72", t72, 72);
  assertLen("96", t96, 96);

  const t120Base = dedupeConcatGroups(
    groups,
    packages["120色"]!.use_groups!,
    packages["120色"]?.exclude,
  );
  const t120 = padToLength(t120Base, 120, fillPool, "120");
  assertNoDup(t120, "120");

  const t144Base = dedupeConcatGroups(
    groups,
    packages["144色"]!.use_groups!,
    packages["144色"]?.exclude,
  );
  const t144 = padToLength(t144Base, 144, fillPool, "144");
  assertNoDup(t144, "144");

  const t216Base = dedupeConcatGroups(
    groups,
    packages["216色"]!.use_groups!,
    packages["216色"]?.exclude,
  );
  const t216 = padToLength(t216Base, 216, fillPool, "216");
  assertNoDup(t216, "216");

  const t264Base = dedupeConcatGroups(
    groups,
    packages["264色"]!.use_groups!,
    packages["264色"]?.exclude,
  );
  const t264 = padToLength(t264Base, 264, fillPool, "264");
  assertNoDup(t264, "264");

  const tiers = JSON.parse(await readFile(tiersPath, "utf-8")) as Record<string, string[]>;
  const tier221 = tiers["221"];
  if (!tier221 || tier221.length !== 221) {
    throw new Error("standard-tiers 221 must remain length 221");
  }

  const next = {
    ...tiers,
    "24": t24,
    "48": t48,
    "72": t72,
    "96": t96,
    "120": t120,
    "144": t144,
    "216": t216,
    "221": tier221,
    "264": t264,
  };

  await writeFile(tiersPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  console.log(
    "[apply-mard-packages] updated standard-tiers 24–264 (deduped+padded where needed); 221 unchanged",
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
