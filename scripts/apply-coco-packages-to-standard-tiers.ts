/**
 * Resolves COCO brand codes in `coco-package-layout.json` to `masterColorId` via
 * `coco.mapping.json`, then writes `coco-standard-tiers.json` (24–96 from explicit
 * codes; 120/144/168/192/221/293 dedupe `use_groups` then pad from master+extension order).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CocoMapping = Record<string, string | null>;

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

function buildReverseMap(mapping: CocoMapping): Map<string, string> {
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
      throw new Error(`Ambiguous COCO code "${k}" -> ${mids.join(", ")}`);
    }
    out.set(k, mids[0]!);
  }
  return out;
}

/**
 * Layout strings are COCO product codes. Prefer reverse lookup so codes like `F13`
 * (bead label → master B17) do not collide with master id `F13` (→ brand C04).
 */
function resolveToken(
  token: string,
  mapping: CocoMapping,
  reverse: Map<string, string>,
): string {
  const fromCode = reverse.get(token);
  if (fromCode !== undefined) {
    return fromCode;
  }
  if (Object.prototype.hasOwnProperty.call(mapping, token)) {
    return token;
  }
  throw new Error(`Unresolved COCO layout token: "${token}"`);
}

function mapCodes(codes: string[], mapping: CocoMapping, reverse: Map<string, string>): string[] {
  return codes.map((c) => resolveToken(c, mapping, reverse));
}

function dedupeConcatGroups(
  groups: Record<string, string[]>,
  names: string[],
  exclude: string[] | undefined,
  mapping: CocoMapping,
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
  const layoutPath = path.join(root, "src/data/presets/coco-package-layout.json");
  const mappingPath = path.join(root, "src/data/mappings/coco.mapping.json");
  const outPath = path.join(root, "src/data/presets/coco-standard-tiers.json");
  const masterPath = path.join(root, "src/data/palettes/mard221.master.json");
  const extPath = path.join(root, "src/data/palettes/extension-color-overrides.json");

  const layout = JSON.parse(await readFile(layoutPath, "utf-8")) as Layout;
  const mapping = JSON.parse(await readFile(mappingPath, "utf-8")) as CocoMapping;
  const reverse = buildReverseMap(mapping);
  const { groups, packages } = layout;

  const masterList = (JSON.parse(await readFile(masterPath, "utf-8")) as { id: string }[]).map(
    (r) => r.id,
  );
  const extKeys = Object.keys(JSON.parse(await readFile(extPath, "utf-8")) as Record<string, unknown>);
  const fillPool = [...masterList, ...extKeys.sort((a, b) => a.localeCompare(b))];

  const t24 = mapCodes(packages["24色"]!.codes!, mapping, reverse);
  const t48 = mapCodes(packages["48色"]!.codes!, mapping, reverse);
  const t72 = mapCodes(packages["72色"]!.codes!, mapping, reverse);
  const t96 = mapCodes(packages["96色"]!.codes!, mapping, reverse);
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

  const t221Base = dedupeConcatGroups(
    groups,
    packages["221色"]!.use_groups!,
    packages["221色"]?.exclude,
    mapping,
    reverse,
  );
  const t221 = padToLength(t221Base, 221, fillPool, "221");
  assertNoDup(t221, "221");

  const t293Base = dedupeConcatGroups(
    groups,
    packages["293色"]!.use_groups!,
    packages["293色"]?.exclude,
    mapping,
    reverse,
  );
  const t293 = padToLength(t293Base, 293, fillPool, "293");
  assertNoDup(t293, "293");

  const next = {
    "24": t24,
    "48": t48,
    "72": t72,
    "96": t96,
    "120": t120,
    "144": t144,
    "168": t168,
    "192": t192,
    "221": t221,
    "293": t293,
  };

  await writeFile(outPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  console.log("[apply-coco-packages] wrote coco-standard-tiers.json (master ids)");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
