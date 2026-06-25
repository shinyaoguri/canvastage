import { z } from "zod";
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
  username?: string;
  // write 権限の有無（スケッチ/コードの作成・更新ができるか）。Plus+ 会員が
  // write 付きで発行したトークンのみ true。実トークンで確認済みのフラグ名。
  canWrite: boolean;
}

export interface SketchMeta {
  title: string;
  description?: string;
  isPrivate?: boolean;
  license?: string;
}

// whoami / createSketch のレスポンスのうち本アプリが使う部分を検証する。
// id 系は API が文字列で返すことがあるため数値に強制変換する。フラグは 1/0/true/false
// など揺れがあるので boolean には固定しない（Boolean() 側で吸収）。
const WhoAmISchema = z.looseObject({
  username: z.string().optional(),
});

const SketchCreateSchema = z.looseObject({
  visualID: z.coerce.number().optional(),
  id: z.coerce.number().optional(),
});

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
  const raw = unwrap(await apiFetch("/api/whoami", { token }));
  const parsed = WhoAmISchema.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new OpenProcessingError(
      "OpenProcessing の応答が想定外の形式でした。",
      "api"
    );
  }
  return {
    username: parsed.data.username,
    canWrite: Boolean(parsed.data.tokenWriteAccess),
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
  const raw = unwrap(
    await apiFetch("/api/sketch", { method: "POST", token, body })
  );
  const parsed = SketchCreateSchema.safeParse(raw);
  const id = parsed.success
    ? (parsed.data.visualID ?? parsed.data.id)
    : undefined;
  if (id === undefined || Number.isNaN(id)) {
    throw new OpenProcessingError(
      "スケッチ作成の応答に有効な ID が含まれていませんでした。",
      "api"
    );
  }
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

// スケッチの既存コードタブのタイトル集合を取得する。
export async function listCodeTitles(
  token: string,
  sketchId: number
): Promise<Set<string>> {
  const data = unwrap(
    await apiFetch(`/api/sketch/${sketchId}/code`, { token })
  );
  const titles = new Set<string>();
  if (Array.isArray(data)) {
    for (const c of data) {
      const t = (c as { title?: unknown })?.title;
      if (typeof t === "string") titles.add(t);
    }
  }
  return titles;
}

// コードタブを反映する。存在すれば PATCH、無ければ POST。
//
// 重要: 「まず PATCH→404 なら POST」という手は使えない。OpenProcessing の 404
// レスポンス（特に /code/index.html）は CORS ヘッダを返さないため、ブラウザでは
// 404 を読めず CORS エラーとして失敗する。呼び出し側で exists を先に判定して
// 404 を踏まないようにする。
export async function putCode(
  token: string,
  sketchId: number,
  title: string,
  code: string,
  orderID: number,
  exists: boolean
): Promise<void> {
  const path = `/api/sketch/${sketchId}/code/${encodeURIComponent(title)}`;
  const body = { code, orderID };
  await apiFetch(path, { method: exists ? "PATCH" : "POST", token, body });
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
// onCreated は新規作成の直後（コード反映の前）に呼ばれる。途中失敗時も呼び出し側で
// 新しい sketchId を保持でき、再試行でオーファンスケッチを量産しない。
export async function deploySketch(
  token: string,
  files: Files,
  meta: SketchMeta,
  existingId?: number | null,
  onCreated?: (id: number) => void
): Promise<SketchRef> {
  let ref: SketchRef;
  if (existingId == null) {
    ref = await createSketch(token, meta);
    onCreated?.(ref.id);
  } else {
    await updateSketch(token, existingId, meta);
    ref = { id: existingId, url: `${BASE_URL}/sketch/${existingId}` };
  }

  // 既存タブを先に取得し、404（CORS 無し）を踏まずに PATCH/POST を振り分ける。
  const existing = await listCodeTitles(token, ref.id);
  for (let i = 0; i < CODE_TABS.length; i++) {
    const tab = CODE_TABS[i];
    await putCode(
      token,
      ref.id,
      tab.title,
      tab.pick(files),
      i,
      existing.has(tab.title)
    );
  }
  return ref;
}
