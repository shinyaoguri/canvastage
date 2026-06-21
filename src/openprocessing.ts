import type { Files } from "./preview";

// OpenProcessing Public API クライアント。
// 認証は Bearer トークン。書き込み（スケッチ/コードの作成・更新）は Plus+ 会員が
// 発行した write 権限トークンが必須（無料トークンは read-only）。
// canvastage の {html, css, js} は html モードの 3 コードタブ
// (index.html / style.css / sketch.js) としてマップする。
// API 調査メモは Postman 公開コレクション "OpenProcessing Public API" 由来。

const BASE_URL = "https://openprocessing.org";

export class OpenProcessingError extends Error {
  constructor(
    message: string,
    public code: "auth" | "forbidden" | "api" | "network",
    public status?: number
  ) {
    super(message);
    this.name = "OpenProcessingError";
  }
}

export interface SketchRef {
  id: number;
  url: string;
}

export interface WhoAmI {
  userID?: number;
  username?: string;
  // write 権限の有無。OpenProcessing のフラグ名は実トークンでの検証前なので、
  // 想定されるいくつかの形を許容して判定する（スモークテストで確定する）。
  canWrite: boolean;
  raw: unknown;
}

export interface SketchMeta {
  title: string;
  description?: string;
  isPrivate?: boolean;
  license?: string;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// 一部のエンドポイントは封筒型 {success,message,object,...} を返し、公開 read は
// 生のオブジェクト/配列を返す。両対応で中身を取り出す。
function unwrap(data: unknown): unknown {
  if (
    data &&
    typeof data === "object" &&
    "object" in data &&
    "success" in data
  ) {
    return (data as { object: unknown }).object;
  }
  return data;
}

// undefined のフィールドを落とす（ホワイトリスト外属性は API が 400 を返すため）。
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  token: string;
  body?: unknown;
}

async function apiFetch(path: string, opts: ApiOptions): Promise<unknown> {
  const headers: Record<string, string> = authHeaders(opts.token);
  let bodyText: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyText = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: bodyText,
    });
  } catch {
    throw new OpenProcessingError(
      "ネットワークエラーが発生しました。",
      "network"
    );
  }

  if (res.status === 401) {
    throw new OpenProcessingError(
      "トークンが無効です。設定で再入力してください。",
      "auth",
      401
    );
  }
  if (res.status === 403) {
    throw new OpenProcessingError(
      "書き込み権限がありません（Plus+ の write トークンが必要です）。",
      "forbidden",
      403
    );
  }

  const text = await res.text();
  if (!res.ok) {
    let message = `OpenProcessing API error (${res.status})`;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed?.message) message = parsed.message;
    } catch {
      /* 本文が JSON でなければ既定メッセージ */
    }
    throw new OpenProcessingError(message, "api", res.status);
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function whoami(token: string): Promise<WhoAmI> {
  const data = unwrap(await apiFetch("/api/whoami", { token })) as Record<
    string,
    unknown
  > | null;
  const flags = (data ?? {}) as Record<string, unknown>;
  // 想定されるフラグ名を順に確認（実トークン検証で確定予定）。
  const scopes = (flags.scopes ?? flags.access ?? {}) as Record<
    string,
    unknown
  >;
  const canWrite = Boolean(
    flags.canWrite ?? flags.write ?? scopes.write ?? scopes.canWrite
  );
  return {
    userID: flags.userID as number | undefined,
    username: flags.username as string | undefined,
    canWrite,
    raw: data,
  };
}

export async function createSketch(
  token: string,
  meta: SketchMeta
): Promise<SketchRef> {
  const body = compact({
    title: meta.title.slice(0, 60),
    mode: "html",
    description: meta.description,
    isPrivate: meta.isPrivate,
    license: meta.license,
  });
  const data = unwrap(
    await apiFetch("/api/sketch", { method: "POST", token, body })
  ) as Record<string, unknown>;
  const id = (data.visualID ?? data.id) as number;
  return { id, url: `${BASE_URL}/sketch/${id}` };
}

export async function updateSketch(
  token: string,
  sketchId: number,
  meta: SketchMeta
): Promise<void> {
  const body = compact({
    title: meta.title.slice(0, 60),
    description: meta.description,
    isPrivate: meta.isPrivate,
    license: meta.license,
  });
  await apiFetch(`/api/sketch/${sketchId}`, { method: "PATCH", token, body });
}

// コードタブを作成 or 更新する。既存タブは PATCH、無ければ（404）POST で作成。
export async function upsertCode(
  token: string,
  sketchId: number,
  title: string,
  code: string,
  orderID: number
): Promise<void> {
  const path = `/api/sketch/${sketchId}/code/${encodeURIComponent(title)}`;
  const body = { code, orderID };
  try {
    await apiFetch(path, { method: "PATCH", token, body });
  } catch (err) {
    if (err instanceof OpenProcessingError && err.status === 404) {
      await apiFetch(path, { method: "POST", token, body });
      return;
    }
    throw err;
  }
}

// canvastage の 3 ファイルを html モードの 3 タブとして並べる（タブ順 = orderID）。
const CODE_TABS: ReadonlyArray<{ title: string; pick: (f: Files) => string }> =
  [
    { title: "index.html", pick: (f) => f.html },
    { title: "style.css", pick: (f) => f.css },
    { title: "sketch.js", pick: (f) => f.js },
  ];

// スケッチを新規作成 or 既存更新し、3 タブのコードを反映する。
// existingId が null/undefined のときは新規作成。
export async function deploySketch(
  token: string,
  files: Files,
  meta: SketchMeta,
  existingId?: number | null
): Promise<SketchRef> {
  let ref: SketchRef;
  if (existingId == null) {
    ref = await createSketch(token, meta);
  } else {
    await updateSketch(token, existingId, meta);
    ref = { id: existingId, url: `${BASE_URL}/sketch/${existingId}` };
  }

  for (let i = 0; i < CODE_TABS.length; i++) {
    await upsertCode(
      token,
      ref.id,
      CODE_TABS[i].title,
      CODE_TABS[i].pick(files),
      i
    );
  }
  return ref;
}
