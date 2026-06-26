#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/load-env.ts";
import { parseMarkdown } from "./lib/frontmatter.ts";

loadEnv();

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const [mdPath] = positional;
const dryRun = flags.has("--dry-run");
const force = flags.has("--force");

if (!mdPath) {
  console.error("usage: tsx cross-post.ts <article.md> [--dry-run] [--force]");
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const absPath = resolve(process.cwd(), mdPath);
const { frontmatter } = parseMarkdown(absPath);

const targets = [
  { key: "qiita", enabled: frontmatter.cross_post?.qiita, script: "post-qiita.ts" },
  { key: "zenn", enabled: frontmatter.cross_post?.zenn, script: "post-zenn.ts" },
  { key: "note", enabled: frontmatter.cross_post?.note, script: "post-note.ts" },
];

const enabled = targets.filter((t) => force || t.enabled);
if (!enabled.length) {
  console.error(
    "no cross_post target enabled. add cross_post: { qiita: true } / { zenn: true } to frontmatter, or pass --force"
  );
  process.exit(2);
}

const exitCodes: { key: string; code: number }[] = [];
for (const t of enabled) {
  console.log(`\n=== ${t.key} ===`);
  const cliArgs = [resolve(__dirname, t.script), absPath];
  if (dryRun) cliArgs.push("--dry-run");
  if (force) cliArgs.push("--force");
  const code = await new Promise<number>((res) => {
    const child = spawn("npx", ["tsx", ...cliArgs], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (c) => res(c ?? 1));
  });
  exitCodes.push({ key: t.key, code });
}

const failed = exitCodes.filter((e) => e.code !== 0);
if (failed.length) {
  console.error(`\nfailed: ${failed.map((e) => e.key).join(", ")}`);
  process.exit(1);
}
console.log("\nall done.");
