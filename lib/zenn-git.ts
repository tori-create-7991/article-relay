import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type ZennFrontmatter = {
  title: string;
  emoji: string;
  type: "tech" | "idea";
  topics: string[];
  published: boolean;
  published_at?: string;
};

export type ZennPostInput = {
  slug: string;
  frontmatter: ZennFrontmatter;
  body: string;
};

export type ZennPostResult = {
  slug: string;
  url: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function sh(cwd: string, cmd: string): string {
  return execSync(cmd, { cwd, encoding: "utf8" }).trim();
}

function serializeZennFrontmatter(fm: ZennFrontmatter): string {
  const lines = [
    `title: "${fm.title.replace(/"/g, '\\"')}"`,
    `emoji: "${fm.emoji}"`,
    `type: "${fm.type}"`,
    `topics: [${fm.topics.map((t) => `"${t}"`).join(", ")}]`,
    `published: ${fm.published}`,
  ];
  if (fm.published_at) lines.push(`published_at: "${fm.published_at}"`);
  return lines.join("\n");
}

function detectZennUser(repoPath: string): string {
  // Try to read git remote URL like git@github.com:user/zenn-content.git
  try {
    const url = sh(repoPath, "git remote get-url origin");
    const m =
      url.match(/github\.com[:/]([^/]+)\//) ??
      url.match(/zenn\.dev\/([^/]+)/);
    if (m) return m[1];
  } catch {
    // fall through
  }
  return process.env.ZENN_USER ?? "";
}

/** Zenn 連携リポに記事を書き、コミット＆push する */
export async function publishArticle(
  input: ZennPostInput
): Promise<ZennPostResult> {
  const repo = requireEnv("ZENN_REPO_PATH");
  const branch = process.env.ZENN_BRANCH ?? "main";
  if (!existsSync(repo)) {
    throw new Error(`ZENN_REPO_PATH does not exist: ${repo}`);
  }

  // pull latest
  sh(repo, `git checkout ${branch}`);
  sh(repo, `git pull --rebase --autostash origin ${branch}`);

  const articlesDir = join(repo, "articles");
  mkdirSync(articlesDir, { recursive: true });
  const filePath = join(articlesDir, `${input.slug}.md`);
  const yaml = serializeZennFrontmatter(input.frontmatter);
  const content = `---\n${yaml}\n---\n${input.body.startsWith("\n") ? input.body : "\n" + input.body}`;
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");

  // commit options
  const authorName = process.env.ZENN_AUTHOR_NAME;
  const authorEmail = process.env.ZENN_AUTHOR_EMAIL;
  const authorEnv =
    authorName && authorEmail
      ? `GIT_AUTHOR_NAME='${authorName}' GIT_AUTHOR_EMAIL='${authorEmail}' GIT_COMMITTER_NAME='${authorName}' GIT_COMMITTER_EMAIL='${authorEmail}'`
      : "";

  sh(repo, `git add articles/${input.slug}.md`);
  // skip commit if nothing changed
  const diff = sh(repo, "git diff --cached --name-only");
  if (!diff) {
    return { slug: input.slug, url: zennUrl(repo, input.slug) };
  }
  sh(
    repo,
    `${authorEnv} git commit -m ${JSON.stringify(`article: ${input.slug}`)}`
  );
  sh(repo, `git push origin ${branch}`);

  return { slug: input.slug, url: zennUrl(repo, input.slug) };
}

function zennUrl(repoPath: string, slug: string): string {
  const user = detectZennUser(repoPath);
  if (!user) return `https://zenn.dev/articles/${slug}`;
  return `https://zenn.dev/${user}/articles/${slug}`;
}
