import { readFileSync, writeFileSync } from "node:fs";

export type ArticleFrontmatter = {
  title?: string;
  date?: string;
  tags?: string[];
  topics?: string[];
  category?: string;
  private?: boolean;
  cross_post?: {
    qiita?: boolean;
    zenn?: boolean;
    note?: boolean;
    devto?: boolean;
  };
  qiita_url?: string | null;
  qiita_id?: string | null;
  zenn_url?: string | null;
  zenn_slug?: string | null;
  zenn_emoji?: string;
  zenn_type?: "tech" | "idea";
  note_url?: string | null;
  note_id?: string | null;
  [key: string]: unknown;
};

export type ParsedArticle = {
  frontmatter: ArticleFrontmatter;
  body: string;
  rawFrontmatter: string;
};

/** Markdown ファイルから frontmatter + 本文をパース */
export function parseMarkdown(path: string): ParsedArticle {
  const raw = readFileSync(path, "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: raw, rawFrontmatter: "" };
  }
  return {
    frontmatter: parseYaml(match[1]),
    body: match[2],
    rawFrontmatter: match[1],
  };
}

/** ごく軽量な YAML パーサ。スカラー / 配列 / ネストオブジェクト 1 段のみサポート */
function parseYaml(text: string): ArticleFrontmatter {
  const obj: Record<string, unknown> = {};
  const lines = text.split("\n");
  let currentKey: string | null = null;
  let currentObj: Record<string, unknown> | null = null;
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const topMatch = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    const nestedMatch = line.match(/^\s+([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (topMatch && !line.startsWith(" ") && !line.startsWith("\t")) {
      currentKey = topMatch[1];
      const value = topMatch[2].trim();
      if (value === "") {
        currentObj = {};
        obj[currentKey] = currentObj;
      } else {
        obj[currentKey] = coerce(value);
        currentObj = null;
      }
    } else if (nestedMatch && currentObj) {
      currentObj[nestedMatch[1]] = coerce(nestedMatch[2].trim());
    }
  }
  return obj as ArticleFrontmatter;
}

function coerce(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return value.replace(/^["']|["']$/g, "");
}

/** frontmatter を YAML 文字列にシリアライズ */
function serializeYaml(fm: ArticleFrontmatter, indent = 0): string {
  const pad = " ".repeat(indent);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(fm)) {
    if (v === null || v === undefined) {
      lines.push(`${pad}${k}: null`);
    } else if (typeof v === "boolean" || typeof v === "number") {
      lines.push(`${pad}${k}: ${v}`);
    } else if (Array.isArray(v)) {
      const items = v.map((x) => JSON.stringify(x)).join(", ");
      lines.push(`${pad}${k}: [${items}]`);
    } else if (typeof v === "object") {
      lines.push(`${pad}${k}:`);
      lines.push(serializeYaml(v as ArticleFrontmatter, indent + 2));
    } else {
      const s = String(v);
      const needsQuote = /[:#&*!|>'"%@`,\[\]\{\}]/.test(s) || s.includes("\n");
      lines.push(`${pad}${k}: ${needsQuote ? JSON.stringify(s) : s}`);
    }
  }
  return lines.join("\n");
}

/** frontmatter を更新して書き戻す */
export function updateFrontmatter(
  path: string,
  patch: Partial<ArticleFrontmatter>
): void {
  const { frontmatter, body } = parseMarkdown(path);
  const merged = { ...frontmatter, ...patch };
  const yaml = serializeYaml(merged);
  const next = `---\n${yaml}\n---\n${body.startsWith("\n") ? body.slice(1) : body}`;
  writeFileSync(path, next, "utf8");
}
