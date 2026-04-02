/**
 * Resolves 漫漫 product codes in `manman-package-layout.json` to `masterColorId`
 * via `manman.mapping.json`, then writes `manman-standard-tiers.json` (24 用显式 codes；
 * 其余档位按 use_groups 去重后按主色+扩展键顺序补齐)。
 *
 * 不做 283 色套装（仅 221 主色体系内的档位）。
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ManmanMapping = Record<string, string | null>;

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

function buildReverseMap(mapping: ManmanMapping): Map<string, string> {
  const rev = new Map<string, string[]>();
  for (const [masterId, code] of Object.entries(mapping)) {
    if (code == null || code === "") continue;
    const k = String(code).trim();
    if (!rev.has(k)) rev.set(k, []);
    rev.get(k)!.push(masterId);
  }
  const out = new Map<string, string>();
  for (const [k, mids] of rev) {
    if (mids.length > 1) {
      throw new Error(`Ambiguous 漫漫 code "${k}" -> ${mids.join(", ")}`);
    }
    out.set(k, mids[0]!);
  }
  return out;
}

/** IC4 / IC04、YX08 / YX8 等与映射表对齐 */
function manmanCodeAliases(token: string): string[] {
  const out: string[] = [token];
  const ic = /^IC(\d+)$/i.exec(token);
  if (ic) {
    const n = Number.parseInt(ic[1], 10);
    if (Number.isFinite(n)) {
      out.push(`IC${n}`);
      out.push(`IC${String(n).padStart(2, "0")}`);
    }
  }
  const yx = /^YX(\d+)$/i.exec(token);
  if (yx) {
    const n = Number.parseInt(yx[1], 10);
    if (Number.isFinite(n)) {
      out.push(`YX${n}`);
      out.push(`YX${String(n).padStart(2, "0")}`);
    }
  }
  return [...new Set(out)];
}

/**
 * 布局为漫漫对外色号；反查优先（避免与主色 id 字符串撞名）。
 */
function resolveToken(
  token: string,
  mapping: ManmanMapping,
  reverse: Map<string, string>,
): string {
  for (const alt of manmanCodeAliases(token)) {
    const mid = reverse.get(alt);
    if (mid !== undefined) return mid;
  }
  for (const alt of manmanCodeAliases(token)) {
    if (Object.prototype.hasOwnProperty.call(mapping, alt)) {
      return alt;
    }
  }
  throw new Error(`Unresolved 漫漫 layout token: "${token}"`);
}

function mapCodes(codes: string[], mapping: ManmanMapping, reverse: Map<string, string>): string[] {
  return codes.map((c) => resolveToken(c, mapping, reverse));
}

function dedupeConcatGroups(
  groups: Record<string, string[]>,
  names: string[],
  exclude: string[] | undefined,
  mapping: ManmanMapping,
  reverse: Map<string, string>,
): string[] {
  const ex = new Set(exclude ?? []);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const list = groups[n];
    if (!list?.length) {
      throw new Error(`Missing group: ${n}`);
    }
    for (const tok of list) {
      if (ex.has(tok)) continue;
      const id = resolveToken(tok, mapping, reverse);
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
  const layoutPath = path.join(root, "src/data/presets/manman-package-layout.json");
  const mappingPath = path.join(root, "src/data/mappings/manman.mapping.json");
  const outPath = path.join(root, "src/data/presets/manman-standard-tiers.json");
  const masterPath = path.join(root, "src/data/palettes/mard221.master.json");
  const extPath = path.join(root, "src/data/palettes/extension-color-overrides.json");

  const layout = JSON.parse(await readFile(layoutPath, "utf-8")) as Layout;
  const mapping = JSON.parse(await readFile(mappingPath, "utf-8")) as ManmanMapping;
  const reverse = buildReverseMap(mapping);
  const { groups, packages } = layout;

  const masterList = (JSON.parse(await readFile(masterPath, "utf-8")) as { id: string }[]).map(
    (r) => r.id,
  );
  const extKeys = Object.keys(JSON.parse(await readFile(extPath, "utf-8")) as Record<string, unknown>);
  const fillPool = [...masterList, ...extKeys.sort((a, b) => a.localeCompare(b))];

  const t24 = mapCodes(packages["24色"]!.codes!, mapping, reverse);
  assertNoDup(t24, "24");
  assertLen("24", t24, 24);

  const t48Base = dedupeConcatGroups(groups, packages["48色"]!.use_groups!, packages["48色"]?.exclude, mapping, reverse);
  const t48 = padToLength(t48Base, 48, fillPool, "48");
  assertNoDup(t48, "48");

  const t72Base = dedupeConcatGroups(groups, packages["72色"]!.use_groups!, packages["72色"]?.exclude, mapping, reverse);
  const t72 = padToLength(t72Base, 72, fillPool, "72");
  assertNoDup(t72, "72");

  const t96Base = dedupeConcatGroups(groups, packages["96色"]!.use_groups!, packages["96色"]?.exclude, mapping, reverse);
  const t96 = padToLength(t96Base, 96, fillPool, "96");
  assertNoDup(t96, "96");

  const t120Base = dedupeConcatGroups(
    groups,
    packages["120色"]!.use_groups!,
    packages["120色"]?.exclude,
    mapping,
    reverse,
  );
  const t120 = padToLength(t120Base, 120, fillPool, "120");
  assertNoDup(t120, "120");

  const t144Base = dedupeConcatGroups(
    groups,
    packages["144色"]!.use_groups!,
    packages["144色"]?.exclude,
    mapping,
    reverse,
  );
  const t144 = padToLength(t144Base, 144, fillPool, "144");
  assertNoDup(t144, "144");

  const t168Base = dedupeConcatGroups(
    groups,
    packages["168色"]!.use_groups!,
    packages["168色"]?.exclude,
    mapping,
    reverse,
  );
  const t168 = padToLength(t168Base, 168, fillPool, "168");
  assertNoDup(t168, "168");

  const t192Base = dedupeConcatGroups(
    groups,
    packages["192色"]!.use_groups!,
    packages["192色"]?.exclude,
    mapping,
    reverse,
  );
  const t192 = padToLength(t192Base, 192, fillPool, "192");
  assertNoDup(t192, "192");

  const next = {
    "24": t24,
    "48": t48,
    "72": t72,
    "96": t96,
    "120": t120,
    "144": t144,
    "168": t168,
    "192": t192,
  };

  await writeFile(outPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  console.log("[apply-manman-packages] wrote manman-standard-tiers.json (master ids)");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
