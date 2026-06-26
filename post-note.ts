#!/usr/bin/env node
import { spawn } from "node:child_process";
import { platform } from "node:os";
import { resolve } from "node:path";
import { loadEnv } from "./lib/load-env.ts";
import { parseMarkdown, updateFrontmatter } from "./lib/frontmatter.ts";
import { formatForNote } from "./lib/note-format.ts";
import { copyToClipboard } from "./lib/clipboard.ts";
import { askRequired } from "./lib/prompt.ts";

loadEnv();

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const [mdPath] = positional;
const dryRun = flags.has("--dry-run");
const force = flags.has("--force");
const noOpen = flags.has("--no-open");

if (!mdPath) {
  console.error(
    "usage: tsx post-note.ts <article.md> [--dry-run] [--force] [--no-open]"
  );
  process.exit(2);
}

const absPath = resolve(process.cwd(), mdPath);
const { frontmatter, body } = parseMarkdown(absPath);

if (!frontmatter.title) {
  console.error("frontmatter.title is required");
  process.exit(2);
}

if (!force && !(frontmatter.cross_post?.note ?? false)) {
  console.error(
    "cross_post.note is not true. Use --force to post anyway."
  );
  process.exit(2);
}

const existingUrl = frontmatter.note_url ?? null;
const isUpdate = !!existingUrl;

// note 互換 MD に変換
const { body: formatted, warnings } = formatForNote(body);

// クリップボードに「タイトル + 本文」を投入
const payload = `${frontmatter.title}\n\n${formatted}`;

if (dryRun) {
  console.log("[dry-run] note 投稿プレビュー:");
  console.log(`  title: ${frontmatter.title}`);
  console.log(`  isUpdate: ${isUpdate}`);
  console.log(`  bodyLen: ${formatted.length}`);
  console.log(`  warnings:`);
  for (const w of warnings) console.log(`    - ${w}`);
  console.log(`  payload (head):\n${payload.slice(0, 200)}...`);
  process.exit(0);
}

await copyToClipboard(payload);
console.log("✔ クリップボードにタイトル + 本文をコピーしました");

if (warnings.length) {
  console.log("\n⚠ note 変換時の注意:");
  for (const w of warnings) console.log(`  - ${w}`);
  console.log("");
}

const noteUrl = isUpdate
  ? existingUrl!
  : "https://note.com/notes/new";

if (!noOpen) {
  openInBrowser(noteUrl);
  console.log(`✔ ブラウザを開きました: ${noteUrl}`);
  if (!isUpdate) {
    console.log("  → 本文ペースト時はタイトル行を見出しに反映させてください");
  }
} else {
  console.log(`次の URL を手動で開いてください: ${noteUrl}`);
}

console.log("\n投稿が完了したら、公開 URL を貼り付けてください。");
const url = await askRequired(
  "note の公開 URL > ",
  (s) => (/^https?:\/\/note\.com\//.test(s) ? null : "note.com の URL を入力してください")
);

const idMatch = url.match(/\/n\/([a-zA-Z0-9]+)/);
const noteId = idMatch ? idMatch[1] : null;

updateFrontmatter(absPath, {
  note_url: url,
  note_id: noteId,
});

console.log(`\n✔ frontmatter に書き戻しました: note_url=${url}${noteId ? `, note_id=${noteId}` : ""}`);

function openInBrowser(url: string): void {
  const p = platform();
  let cmd: string;
  let args: string[];
  if (p === "darwin") {
    cmd = "open";
    args = [url];
  } else if (p === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}
