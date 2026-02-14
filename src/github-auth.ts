import { openDB, DBSchema, IDBPDatabase } from "idb";

// GitHub OAuth App の client_id（publicな値なのでクライアントに埋め込みOK）
const GITHUB_CLIENT_ID = "Ov23lidMoieTG2EHB1Jw";

const DB_NAME = "canvastage-auth";
const DB_VERSION = 1;
const STORE_NAME = "auth" as const;
const TOKEN_KEY = "github-token";

interface AuthDB extends DBSchema {
  auth: {
    key: string;
    value: { token: string; createdAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<AuthDB>> | null = null;

function getDB(): Promise<IDBPDatabase<AuthDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AuthDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

export async function getStoredToken(): Promise<string | null> {
  try {
    const db = await getDB();
    const record = await db.get(STORE_NAME, TOKEN_KEY);
    return record?.token ?? null;
  } catch {
    return null;
  }
}

export async function storeToken(token: string): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, { token, createdAt: Date.now() }, TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, TOKEN_KEY);
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
