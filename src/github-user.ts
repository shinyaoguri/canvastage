import { z } from "zod";
import { GistError } from "./gist";

const ViewerSchema = z.object({ login: z.string() });

// 認証ユーザーの login を取得する。
// login は public プロフィールの一部でスコープ要件が無いため、gist スコープの
// トークンでもそのまま取得できる（OAuth のスコープを広げる必要は無い）。
// 取り込んだ Gist が自分のものかを判定するためだけに使う。
export async function fetchViewerLogin(token: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch {
    throw new GistError("ネットワークエラーが発生しました。", "network");
  }

  if (response.status === 401) {
    throw new GistError("トークンが無効です。再認証してください。", "auth");
  }
  if (!response.ok) {
    throw new GistError(`GitHub API error (${response.status})`, "api");
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new GistError("GitHub API の応答を解析できませんでした。", "api");
  }
  const parsed = ViewerSchema.safeParse(json);
  if (!parsed.success) {
    throw new GistError("GitHub API の応答が想定外の形式でした。", "api");
  }
  return parsed.data.login;
}
