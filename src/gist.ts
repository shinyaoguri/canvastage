import type { Files } from "./preview";
import { DEFAULT_HTML, DEFAULT_CSS } from "./defaults";

export interface GistResult {
  id: string;
  url: string;
}

export interface GistImport {
  files: Files;
  projectName: string;
}

export class GistError extends Error {
  constructor(
    message: string,
    public code: "auth" | "api" | "network"
  ) {
    super(message);
    this.name = "GistError";
  }
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

  if (response.status === 401) {
    throw new GistError("トークンが無効です。再認証してください。", "auth");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new GistError(
      (data as { message?: string }).message ||
        `GitHub API error (${response.status})`,
      "api"
    );
  }

  const data = (await response.json()) as { id: string; html_url: string };
  return { id: data.id, url: data.html_url };
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

// _<name>.md タイトルファイル → description の順でプロジェクト名を復元する。
function resolveProjectName(
  description: string | undefined,
  filenames: string[]
): string {
  const titleFile = filenames.find((name) => /^_.*\.md$/.test(name));
  if (titleFile) {
    return titleFile.replace(/^_/, "").replace(/\.md$/, "") || "imported";
  }
  const desc = description?.match(/^(.*?)\s+—\s+canvastage sketch$/);
  return desc ? desc[1] : "imported-sketch";
}

// 公開 Gist を匿名で取得し、canvastage の 3 ファイルとプロジェクト名へマップする。
// index.html / style.css が無い Gist は既定値で補い、最低限実行できる形にする。
export async function fetchGist(gistId: string): Promise<GistImport> {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch {
    throw new GistError("ネットワークエラーが発生しました。", "network");
  }

  if (response.status === 404) {
    throw new GistError(
      "Gist が見つかりません。URL を確認してください（公開 Gist のみ対応）。",
      "api"
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new GistError(
      (data as { message?: string }).message ||
        `GitHub API error (${response.status})`,
      "api"
    );
  }

  const data = (await response.json()) as {
    description?: string;
    files: Record<
      string,
      { filename: string; content: string; truncated?: boolean } | null
    >;
  };
  const fileList = Object.values(data.files).filter(
    (f): f is { filename: string; content: string; truncated?: boolean } =>
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

  return {
    files: {
      html: html?.content ?? DEFAULT_HTML,
      css: css?.content ?? DEFAULT_CSS,
      js: js?.content ?? "",
    },
    projectName: resolveProjectName(
      data.description,
      fileList.map((f) => f.filename)
    ),
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
