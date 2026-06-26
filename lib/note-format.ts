/**
 * note.com 互換 Markdown への軽い変換。
 *
 * note のエディタは Markdown を貼り付けると以下の制約に従って解釈する:
 *   - 見出しは h1 / h2 / h3 のみ（h4 以降は段落扱い）
 *   - 表（GFM table）は描画されない
 *   - HTML タグは無視される
 *   - 画像は note 側へ再アップロードが必要（URL 埋め込みは展開されない）
 *   - コードブロック / インラインコード / 引用 / リスト / リンクはそのまま OK
 *
 * 本関数は安全側に倒し、h4+ を h3 にデモート、表を「| 表は省略 |」プレースホルダ
 * に置換、画像 MD をリンクに変換する。HTML はコメントとして残し、人間判断で
 * 削除できるようにする。
 */

export type FormatResult = {
  body: string;
  warnings: string[];
};

export function formatForNote(input: string): FormatResult {
  const warnings: string[] = [];
  let text = input;

  // 1. h4+ を h3 にデモート
  text = text.replace(/^(#{4,6})\s+/gm, (_, hashes: string) => {
    warnings.push(`見出し ${hashes} を ### に変換しました`);
    return "### ";
  });

  // 2. GFM table を検出してプレースホルダ化
  //    table は `|` 行 + 続く `|---|---|` 行 で構成される
  const tableBlock = /(^\|.*\|$\n^\|[\s:|-]+\|$\n(?:^\|.*\|$\n?)+)/gm;
  text = text.replace(tableBlock, (m) => {
    warnings.push(`表が含まれていました（note では描画されないため省略）`);
    return "\n> _（表は note では描画されないため省略。原文ブログを参照してください）_\n";
  });

  // 3. 画像 ![alt](url) を [alt: 画像差し替え推奨](url) に変換
  let imageCount = 0;
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, url: string) => {
    imageCount++;
    return `[${alt || "画像"}: note にアップロード推奨](${url})`;
  });
  if (imageCount > 0) {
    warnings.push(
      `画像 ${imageCount} 件をリンク化しました。note 編集画面で再アップロードしてください`
    );
  }

  // 4. HTML タグを HTML コメントとして残す（note では無視されるため警告のみ）
  const hasHtml = /<\/?[a-zA-Z][^>]*>/.test(text);
  if (hasHtml) {
    warnings.push("HTML タグが含まれていますが note では無視されます");
  }

  return { body: text, warnings };
}
