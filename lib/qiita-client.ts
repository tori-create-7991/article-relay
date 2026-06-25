const QIITA_API = "https://qiita.com/api/v2";

export type QiitaTag = { name: string; versions?: string[] };

export type QiitaPostInput = {
  title: string;
  body: string;
  tags: QiitaTag[];
  private?: boolean;
  tweet?: boolean;
  organization_url_name?: string;
};

export type QiitaPostResult = {
  id: string;
  url: string;
};

export class QiitaError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Qiita API ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

function token(): string {
  const t = process.env.QIITA_TOKEN;
  if (!t) throw new Error("QIITA_TOKEN is not set");
  return t;
}

/** 新規投稿。返り値は item.id + url */
export async function createItem(
  input: QiitaPostInput
): Promise<QiitaPostResult> {
  const res = await fetch(`${QIITA_API}/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) throw new QiitaError(res.status, text);
  const data = JSON.parse(text) as { id: string; url: string };
  return { id: data.id, url: data.url };
}

/** 既存記事の更新 */
export async function updateItem(
  itemId: string,
  input: QiitaPostInput
): Promise<QiitaPostResult> {
  const res = await fetch(`${QIITA_API}/items/${itemId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) throw new QiitaError(res.status, text);
  const data = JSON.parse(text) as { id: string; url: string };
  return { id: data.id, url: data.url };
}
