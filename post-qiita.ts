#!/usr/bin/env node
import { resolve } from "node:path";
import { loadEnv } from "./lib/load-env.ts";
import { parseMarkdown, updateFrontmatter } from "./lib/frontmatter.ts";
import { createItem, updateItem, type QiitaTag } from "./lib/qiita-client.ts";

loadEnv();

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const [mdPath] = positional;
const dryRun = flags.has("--dry-run");
const force = flags.has("--force");

if (!mdPath) {
  console.error("usage: tsx post-qiita.ts <article.md> [--dry-run] [--force]");
  process.exit(2);
}

const absPath = resolve(process.cwd(), mdPath);
const { frontmatter, body } = parseMarkdown(absPath);

if (!frontmatter.title) {
  console.error("frontmatter.title is required");
  process.exit(2);
}

if (!force && !(frontmatter.cross_post?.qiita ?? false)) {
  console.error(
    "cross_post.qiita is not true. Use --force to post anyway."
  );
  process.exit(2);
}

const tags: QiitaTag[] = (frontmatter.tags ?? []).map((name) => ({
  name,
  versions: [],
}));

const input = {
  title: frontmatter.title,
  body,
  tags,
  private: frontmatter.private ?? false,
  tweet: false,
};

if (dryRun) {
  console.log("[dry-run] would post:", {
    title: input.title,
    tags: tags.map((t) => t.name),
    private: input.private,
    bodyLen: body.length,
    existingId: frontmatter.qiita_id ?? null,
  });
  process.exit(0);
}

const existingId = frontmatter.qiita_id ?? null;
const result = existingId
  ? await updateItem(existingId, input)
  : await createItem(input);

updateFrontmatter(absPath, {
  qiita_url: result.url,
  qiita_id: result.id,
});

console.log(existingId ? "updated:" : "created:", result.url);
