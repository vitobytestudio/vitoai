/**
 * PRUNE — keep the studio's storage honest.
 *
 * Two very different kinds of "space" get confused, so this prints both:
 *
 *   checkout   what sits on disk and in the working tree. Deleting a file
 *              frees this immediately.
 *   history    what the .git pack still carries. Deleting a file in a new
 *              commit does NOT remove its bytes; they survive in the commit
 *              that added it. Only a history rewrite (git filter-repo) or a
 *              fresh repository removes them.
 *
 * Policy this enforces:
 *   inbox/       source clips. Deleted once the film that used them has been
 *                delivered. Nothing here is ever committed (.gitignore).
 *   outbox/      hand-back copies. Same rule.
 *   deliverables/ the delivered films. Keep the newest N, plus anything listed
 *                in deliverables/keep.txt, plus anything the site links to.
 *
 *   node tools/prune.mjs            dry run, prints the plan
 *   node tools/prune.mjs --go       delete what the plan says
 *   node tools/prune.mjs --keep 6   change how many films survive
 */
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const GO = process.argv.includes("--go");
const keepIdx = process.argv.indexOf("--keep");
const KEEP = keepIdx > -1 ? Math.max(1, Number(process.argv[keepIdx + 1]) || 6) : 6;

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const dirSize = (dir) => {
  if (!existsSync(dir)) return { n: 0, bytes: 0, files: [] };
  const files = readdirSync(dir)
    .filter((f) => !f.startsWith("."))
    .map((f) => ({ f, p: join(dir, f), s: statSync(join(dir, f)) }))
    .filter((x) => x.s.isFile());
  return { n: files.length, bytes: files.reduce((a, x) => a + x.s.size, 0), files };
};

/* ------------------------------------------------------------- the report */

const git = (args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

const pack = git(["count-objects", "-vH"]);
const packLine = (pack.match(/size-pack:\s*([\d.]+\s*\w+)/) || [])[1] || "?";
const looseLine = (pack.match(/size:\s*([\d.]+\s*\w+)/) || [])[1] || "?";

console.log(`\n  repo history   ${packLine} packed · ${looseLine} loose`);
const inbox = dirSize("inbox");
const outbox = dirSize("outbox");
const deliver = dirSize("deliverables");
console.log(`  inbox/         ${inbox.n} files · ${mb(inbox.bytes)}`);
console.log(`  outbox/        ${outbox.n} files · ${mb(outbox.bytes)}`);
console.log(`  deliverables/  ${deliver.n} files · ${mb(deliver.bytes)}`);

/* --------------------------------------------------------------- the plan */

const plan = [];

// 1 · source clips and hand-backs go as soon as they have been delivered
for (const [dir, state] of [
  ["inbox", inbox],
  ["outbox", outbox],
]) {
  for (const x of state.files) plan.push({ why: "delivered source", path: x.p, bytes: x.s.size });
}

// 2 · deliverables: newest KEEP survive, anything pinned survives
const pinnedPath = "deliverables/keep.txt";
const pinned = existsSync(pinnedPath)
  ? readFileSync(pinnedPath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
  : [];

const films = deliver.files.filter((x) => /\.(mp4|mov|webm)$/i.test(x.f)).sort((a, b) => b.s.mtimeMs - a.s.mtimeMs);
const survivors = new Set(films.slice(0, KEEP).map((x) => x.f));
for (const p of pinned) survivors.add(p);

// anything the site or the docs reference by name must stay
const referenced = new Set();
for (const file of ["studio/site.tsx", "STUDIO_URL.txt", "DELIVERY.md", "README.md"]) {
  if (!existsSync(file)) continue;
  const body = readFileSync(file, "utf8");
  for (const x of films) if (body.includes(x.f)) referenced.add(x.f);
}

for (const x of films) {
  if (survivors.has(x.f) || referenced.has(x.f)) continue;
  plan.push({ why: `older than the last ${KEEP}`, path: x.p, bytes: x.s.size });
}

/* -------------------------------------------------------------- the doing */

if (!plan.length) {
  console.log("\n  nothing to prune.\n");
  process.exit(0);
}

const total = plan.reduce((a, x) => a + x.bytes, 0);
console.log(`\n  ${GO ? "deleting" : "would delete"} ${plan.length} files · ${mb(total)}`);
for (const x of plan) console.log(`   ${GO ? "−" : "·"} ${x.path.padEnd(58)} ${mb(x.bytes).padStart(9)}  ${x.why}`);

if (!GO) {
  console.log(`\n  dry run. re-run with --go to free ${mb(total)} of checkout space.`);
  console.log(`  (history is untouched — see the note at the top of tools/prune.mjs)\n`);
  process.exit(0);
}

for (const x of plan) {
  try {
    unlinkSync(x.path);
  } catch {}
  // if git is tracking it, stop tracking it too
  if (git(["ls-files", "--error-unmatch", x.path])) git(["rm", "--cached", "-q", x.path]);
}
console.log(`\n  freed ${mb(total)} of checkout space.\n`);
