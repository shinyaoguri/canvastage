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

function gistFiles(files: Files) {
  return {
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
  description?: string
): Promise<GistResult> {
  return sendGistRequest("https://api.github.com/gists", "POST", token, {
    description: description || "canvastage sketch",
    public: false,
    files: gistFiles(files),
  });
}

export function updateGist(
  token: string,
  gistId: string,
  files: Files,
  description?: string
): Promise<GistResult> {
  return sendGistRequest(
    `https://api.github.com/gists/${gistId}`,
    "PATCH",
    token,
    {
      description: description || "canvastage sketch",
      files: gistFiles(files),
    }
  );
}
