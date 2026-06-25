#!/usr/bin/env node
import { basename, extname, resolve } from "node:path";
import { loadEnv } from "./lib/load-env.ts";
import { parseMarkdown, updateFrontmatter } from "./lib/frontmatter.ts";
import { publishArticle, type ZennFrontmatter } from "./lib/zenn-git.ts";

loadEnv();

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const [mdPath] = positional;
const dryRun = flags.has("--dry-run");
const force = flags.has("--force");

if (!mdPath) {
  console.error("usage: tsx post-zenn.ts <article.md> [--dry-run] [--force]");
  process.exit(2);
}

const absPath = resolve(process.cwd(), mdPath);
const { frontmatter, body } = parseMarkdown(absPath);

if (!frontmatter.title) {
  console.error("frontmatter.title is required");
  process.exit(2);
}

if (!force && !(frontmatter.cross_post?.zenn ?? false)) {
  console.error("cross_post.zenn is not true. Use --force to post anyway.");
  process.exit(2);
}

const slug =
  frontmatter.zenn_slug ??
  basename(mdPath, extname(mdPath)).toLowerCase().replace(/[^a-z0-9-]/g, "-");

const topics = (frontmatter.topics ?? frontmatter.tags ?? []).slice(0, 5);

const zennFm: ZennFrontmatter = {
  title: frontmatter.title,
  emoji: frontmatter.zenn_emoji ?? "✨",
  type: frontmatter.zenn_type ?? "tech",
  topics,
  published: !(frontmatter.private ?? false),
  published_at: frontmatter.date,
};

if (dryRun) {
  console.log("[dry-run] would publish:", {
    slug,
    title: zennFm.title,
    type: zennFm.type,
    topics: zennFm.topics,
    published: zennFm.published,
    bodyLen: body.length,
  });
  process.exit(0);
}

const result = await publishArticle({ slug, frontmatter: zennFm, body });

updateFrontmatter(absPath, {
  zenn_url: result.url,
  zenn_slug: result.slug,
});

console.log("published:", result.url);
