import { createStore } from "./idb-store";

// GitHub OAuth App の client_id（publicな値なのでクライアントに埋め込みOK）
const GITHUB_CLIENT_ID = "Ov23lidMoieTG2EHB1Jw";

const TOKEN_KEY = "github-token";
const store = createStore<{ token: string; createdAt: number }>("canvastage-auth", "auth");

export async function getStoredToken(): Promise<string | null> {
  try {
    const record = await store.get(TOKEN_KEY);
    return record?.token ?? null;
  } catch {
    return null;
  }
}

export async function storeToken(token: string): Promise<void> {
  await store.put(TOKEN_KEY, { token, createdAt: Date.now() });
}

export async function clearToken(): Promise<void> {
  await store.delete(TOKEN_KEY);
}

export function initiateOAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    const state = crypto.randomUUID();
    const redirectUri = `${window.location.origin}/api/auth/callback`;

    const authUrl =
      `https://github.com/login/oauth/authorize` +
      `?client_id=${GITHUB_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=gist` +
      `&state=${state}`;

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      authUrl,
      "github-oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!popup) {
      reject(new Error("ポップアップがブロックされました。ポップアップを許可してください。"));
      return;
    }

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "github-auth-success") {
        if (event.data.state !== state) {
          cleanup();
          reject(new Error("OAuth state mismatch"));
          return;
        }
        cleanup();
        resolve(event.data.token);
      } else if (event.data?.type === "github-auth-error") {
        cleanup();
        reject(new Error(event.data.error || "認証に失敗しました。"));
      }
    };

    const pollTimer = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("認証がキャンセルされました。"));
      }
    }, 500);

    const cleanup = () => {
      window.removeEventListener("message", handler);
      clearInterval(pollTimer);
      if (!popup.closed) popup.close();
    };

    window.addEventListener("message", handler);
  });
}
