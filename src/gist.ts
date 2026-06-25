import type { Files } from "./preview";

export interface GistResult {
  id: string;
  url: string;
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
