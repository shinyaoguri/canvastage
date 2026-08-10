import { z } from "zod";
import type { Files } from "./preview";
import { DEFAULT_HTML, DEFAULT_CSS } from "./defaults";

// GitHub Gist API のレスポンスのうち本アプリが使う部分だけを検証する。
// 想定外の形（エラーエンベロープが 200 で返る等）を早期に弾き、undefined の id が
// 後続処理へ流れ込むのを防ぐ。未知フィールドは読まないので strip（既定）でよい。

// 匿名 Gist には owner 自体が無く、null で返る個体もあるので nullish で受ける。
const GistOwnerSchema = z.object({ login: z.string() }).nullish();

const GistResultSchema = z.object({
  id: z.string(),
  html_url: z.string(),
  owner: GistOwnerSchema,
});

const GistFileSchema = z
  .object({
    filename: z.string(),
    content: z.string(),
    truncated: z.boolean().optional(),
  })
  .nullable();

// 取得側は id / html_url も optional にしておく。ここを required にすると、
// files だけを返す最小のレスポンス（テストのモック含む）が想定外の形として弾かれる。
const GistResponseSchema = z.object({
  html_url: z.string().optional(),
  updated_at: z.string().optional(),
  description: z.string().optional(),
  owner: GistOwnerSchema,
  files: z.record(z.string(), GistFileSchema),
});

type GistFile = NonNullable<z.infer<typeof GistFileSchema>>;

export interface GistResult {
  id: string;
  url: string;
  /** 所有者の login。匿名 Gist / owner 欠落は null。 */
  ownerLogin: string | null;
}

export interface GistImport {
  files: Files;
  projectName: string;
  /** 取得に使った id をそのまま返す（レスポンスの id は optional なため）。 */
  gistId: string;
  /** 所有者の login。匿名 Gist / owner 欠落は null。 */
  ownerLogin: string | null;
  /** Gist 上に実在するタイトルファイルのベース名。無ければ null。 */
  titleName: string | null;
  htmlUrl: string | null;
  /** 遠隔更新の検知に使う ISO8601 文字列。 */
  updatedAt: string | null;
}

export type GistErrorCode =
  "auth" | "forbidden" | "notfound" | "ratelimit" | "api" | "network";

export class GistError extends Error {
  constructor(
    message: string,
    public code: GistErrorCode
  ) {
    super(message);
    this.name = "GistError";
  }
}

// 取り込んだ Gist が自分のものかを判定する。
// GitHub の login は大文字小文字を区別しない。匿名 Gist（owner 無し）と、
// 自分の login が不明なとき（未認証・取得失敗）は常に false ＝ 新規プロジェクト扱い。
// 誤って attach すると「更新継続中」と誤表示したまま他人の Gist へ PATCH を投げ続ける
// ので、判定不能なら必ず継続しない側へ倒す。
export function isOwnGist(
  ownerLogin: string | null,
  myLogin: string | null
): boolean {
  return Boolean(
    ownerLogin && myLogin && ownerLogin.toLowerCase() === myLogin.toLowerCase()
  );
}

// Gist 一覧のタイトルは「登録順の先頭」ではなく「ファイル名のアルファベット順の
// 先頭」が使われる（.gitignore が常に最上段に出るのと同じ理屈）。プロジェクト名は
// 頭文字がまちまちなので、確実に先頭へ並ぶよう "_" を接頭辞に付けたタイトルファイル
// を 1 つ加える。"_"(0x5F) は英小文字より前に並ぶため index.html / sketch.js /
// style.css のどれよりも前に来て、必ず一覧のタイトルになる。
function sanitizeName(name: string): string {
  // Gist のファイル名に使えない文字（/ や改行）を除く。空なら untitled。
  return name.trim().replace(/[\\/\n\r]+/g, "-") || "untitled";
}

function titleFileName(projectName: string): string {
  return `_${sanitizeName(projectName)}.md`;
}

function titleFileContent(projectName: string): string {
  return `# ${sanitizeName(projectName)}\n\ncanvastage sketch\n`;
}

type GistFileMap = Record<string, { content: string } | null>;

function gistFiles(files: Files, projectName: string): GistFileMap {
  return {
    [titleFileName(projectName)]: { content: titleFileContent(projectName) },
    "index.html": { content: files.html },
    "style.css": { content: files.css },
    "sketch.js": { content: files.js },
  };
}

// HTTP ステータスを GistError.code へ正規化する。
// 403 は「権限が無い」と「レート制限」の両方に使われるので残枠ヘッダで見分ける。
// テスト用の偽 Response は headers を持たないので optional chain で触ること。
function classifyStatus(response: Response): GistErrorCode {
  if (response.status === 401) return "auth";
  if (response.status === 404) return "notfound";
  if (response.status === 429) return "ratelimit";
  if (response.status === 403) {
    const remaining = response.headers?.get?.("x-ratelimit-remaining");
    return remaining === "0" ? "ratelimit" : "forbidden";
  }
  return "api";
}

// 非 ok レスポンスを GistError へ正規化する。呼び出し側が code で分岐できるよう、
// 404 とレート制限を "api" に丸めない（丸めると消えた Gist へ永久にリトライしてしまう）。
async function toGistError(
  response: Response,
  notFoundMessage: string
): Promise<GistError> {
  const code = classifyStatus(response);
  if (code === "auth") {
    return new GistError("トークンが無効です。再認証してください。", code);
  }
  if (code === "notfound") {
    return new GistError(notFoundMessage, code);
  }
  if (code === "ratelimit") {
    return new GistError(
      "GitHub API のアクセス上限に達しました。しばらく待つか、GitHub に接続すると上限が緩和されます。",
      code
    );
  }
  const data = await response.json().catch(() => ({}));
  return new GistError(
    (data as { message?: string }).message ||
      `GitHub API error (${response.status})`,
    code
  );
}

async function sendGistRequest(
  url: string,
  method: "POST" | "PATCH",
  token: string,
  body: Record<string, unknown>
): Promise<GistResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new GistError("ネットワークエラーが発生しました。", "network");
  }

  if (!response.ok) {
    // GitHub は他人の Gist への PATCH も存在秘匿のため 404 を返す。
    // どちらにせよ取るべき対応（連携を解除する）は同じなので両対応の文言にする。
    throw await toGistError(
      response,
      "この Gist を更新できませんでした（削除された、または権限がありません）。"
    );
  }

  const data = await parseJson(response, GistResultSchema);
  return {
    id: data.id,
    url: data.html_url,
    ownerLogin: data.owner?.login ?? null,
  };
}

// レスポンス JSON をデコードしてスキーマ検証する。非 JSON / 想定外の形は
// GistError("api") に正規化し、生の SyntaxError が呼び出し側へ漏れないようにする。
async function parseJson<T>(
  response: Response,
  schema: z.ZodType<T>
): Promise<T> {
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new GistError("GitHub API の応答を解析できませんでした。", "api");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new GistError("GitHub API の応答が想定外の形式でした。", "api");
  }
  return parsed.data;
}

export function createGist(
  token: string,
  files: Files,
  projectName: string,
  description?: string
): Promise<GistResult> {
  return sendGistRequest("https://api.github.com/gists", "POST", token, {
    description: description || "canvastage sketch",
    // 公開 Gist として作成する。可視性は作成時に固定で、後から PATCH では
    // 変更できない（既存 Gist の更新は可視性を保ったまま行われる）。
    public: true,
    files: gistFiles(files, projectName),
  });
}

// URL でも生 ID でも受理し、Gist の id（hex）を取り出す。
// 例: https://gist.github.com/user/<id> / https://gist.github.com/<id> / 生 <id>
export function parseGistId(input: string): string | null {
  const match = input.trim().match(/([0-9a-f]{20,})/i);
  return match ? match[1] : null;
}

const TITLE_FILE_RE = /^_(.*)\.md$/;

// Gist 上に実在するタイトルファイルのベース名を返す。無ければ null。
// これは「表示中のプロジェクト名」とは別物で、更新時に旧タイトルファイルを削除する
// ための実体名として使う（updateGist が titleFileName() で元のファイル名へ戻す）。
// "_.md" のようにベース名が空のものは titleFileName() で復元できない＝canvastage が
// 作ったものではないので、削除対象に指定しないよう null を返す。
export function resolveTitleFileName(filenames: string[]): string | null {
  for (const name of filenames) {
    const match = name.match(TITLE_FILE_RE);
    if (match) return match[1] || null;
  }
  return null;
}

// _<name>.md タイトルファイル → description の順でプロジェクト名を復元する。
export function resolveProjectName(
  description: string | undefined,
  filenames: string[]
): string {
  if (filenames.some((name) => TITLE_FILE_RE.test(name))) {
    // タイトルファイルはあるがベース名が空（"_.md"）なら既定名にする。
    return resolveTitleFileName(filenames) ?? "imported";
  }
  const desc = description?.match(/^(.*?)\s+—\s+canvastage sketch$/);
  return desc ? desc[1] : "imported-sketch";
}

// Gist を取得し、canvastage の 3 ファイルとプロジェクト名へマップする。
// index.html / style.css が無い Gist は既定値で補い、最低限実行できる形にする。
// token を渡すと secret gist も取得でき、レート制限が IP 60/h から 5000/h に緩む。
export async function fetchGist(
  gistId: string,
  token?: string
): Promise<GistImport> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers,
    });
  } catch {
    throw new GistError("ネットワークエラーが発生しました。", "network");
  }

  if (!response.ok) {
    throw await toGistError(
      response,
      token
        ? "Gist が見つかりません。URL を確認してください。"
        : "Gist が見つかりません。URL を確認してください（公開 Gist のみ対応）。"
    );
  }

  const data = await parseJson(response, GistResponseSchema);
  const fileList = Object.values(data.files).filter((f): f is GistFile =>
    Boolean(f)
  );
  const byName = (name: string) => fileList.find((f) => f.filename === name);
  const html = byName("index.html");
  const css = byName("style.css");
  const js = byName("sketch.js");

  if (!html && !css && !js) {
    throw new GistError(
      "canvastage 形式の Gist ではありません（index.html / style.css / sketch.js が見つかりません）。",
      "api"
    );
  }
  // スケッチは通常 1MB 未満。万一 API レスポンスが truncated なら未対応として弾く。
  if ([html, css, js].some((f) => f?.truncated)) {
    throw new GistError(
      "ファイルが大きすぎて取り込めません（1MB 未満にしてください）。",
      "api"
    );
  }

  const filenames = fileList.map((f) => f.filename);
  return {
    files: {
      html: html?.content ?? DEFAULT_HTML,
      css: css?.content ?? DEFAULT_CSS,
      js: js?.content ?? "",
    },
    projectName: resolveProjectName(data.description, filenames),
    gistId,
    ownerLogin: data.owner?.login ?? null,
    titleName: resolveTitleFileName(filenames),
    htmlUrl: data.html_url ?? null,
    updatedAt: data.updated_at ?? null,
  };
}

export function updateGist(
  token: string,
  gistId: string,
  files: Files,
  projectName: string,
  description?: string,
  previousProjectName?: string | null
): Promise<GistResult> {
  const fileMap = gistFiles(files, projectName);
  // プロジェクト名が変わったら、前回のタイトルファイルは削除して残骸を残さない。
  // PATCH でファイルを null にすると Gist から削除される。
  if (
    previousProjectName &&
    titleFileName(previousProjectName) !== titleFileName(projectName)
  ) {
    fileMap[titleFileName(previousProjectName)] = null;
  }
  return sendGistRequest(
    `https://api.github.com/gists/${gistId}`,
    "PATCH",
    token,
    {
      description: description || "canvastage sketch",
      files: fileMap,
    }
  );
}
