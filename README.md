# article-relay

ブログ記事の Markdown を **Qiita / Zenn** にクロスポストする CLI。`x-times-relay` の長文版。

- 自前ブログがマスタ
- 記事 frontmatter の `cross_post` フラグで投稿先を制御
- 投稿後に `qiita_url` / `zenn_url` を frontmatter に書き戻し
- 既存記事は更新（Qiita は API PATCH、Zenn は git push）

## セットアップ

```bash
git clone <this repo>
cd article-relay
npm install
cp env.example .env
# .env を編集（QIITA_TOKEN, ZENN_REPO_PATH …）
```

Node.js 18 以上。

### Qiita

`QIITA_TOKEN` に **write_qiita スコープ** の個人用アクセストークンを設定。
取得: <https://qiita.com/settings/applications> → 個人用アクセストークン → 発行。

### Zenn

Zenn の GitHub 連携リポを **ローカルにクローン** して、その path を `ZENN_REPO_PATH` に設定。
詳細: <https://zenn.dev/zenn/articles/connect-to-github>

```
ZENN_REPO_PATH=/Users/you/Repo/my/zenn-content
ZENN_BRANCH=main
```

git push の commit author を変えたいなら `ZENN_AUTHOR_NAME` / `ZENN_AUTHOR_EMAIL` を設定。

## ブログ記事 frontmatter

```yaml
---
title: "記事タイトル"
date: 2026-06-25
tags: ["Nuxt", "TypeScript"]
topics: ["nuxt", "typescript"]   # Zenn topics（省略時は tags を流用）
private: false
cross_post:
  qiita: true
  zenn: true
qiita_url: null    # 投稿後に書き戻し
qiita_id:  null
zenn_url:  null
zenn_slug: null
zenn_emoji: "✨"  # Zenn 用、省略可
zenn_type:  "tech" # tech | idea
---
本文 Markdown
```

## 使い方

```bash
# 単発: Qiita だけ
npm run qiita -- path/to/article.md

# 単発: Zenn だけ
npm run zenn -- path/to/article.md

# 一括（frontmatter の cross_post に従う）
npm run cross -- path/to/article.md

# ドライラン
npm run cross -- path/to/article.md -- --dry-run

# cross_post フラグを無視して強制投稿
npm run cross -- path/to/article.md -- --force
```

## 仕様メモ

- `qiita_id` がある記事は **更新**（PATCH）、無ければ **新規**（POST）。
- Zenn は **slug** = `zenn_slug` or filename。slug が同じなら同じ記事として上書き、git commit で 1 ファイル更新。
- Zenn の `topics` は最大 5 件まで自動切り詰め（Zenn の制約）。
- ドライラン: API を叩かず、内容だけ表示。
