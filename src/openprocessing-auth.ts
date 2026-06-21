import { createStore } from "./idb-store";

// OpenProcessing の API トークン（アカウント設定 openprocessing.org/user/#edit で発行）。
// GitHub トークンと同じ IndexedDB（canvastage-auth / auth）に別キーで保存する。
// CORS が全開放のためプロキシ不要でブラウザから直接 API を叩ける一方、write 権限
// トークンは「自分の全スケッチを操作できる」強い権限。同一オリジンで信頼コードを
// 実行する既知のトレードオフと同列であり、設定パネルと README に注記する。
const TOKEN_KEY = "openprocessing-token";
const store = createStore<{ token: string; createdAt: number }>(
  "canvastage-auth",
  "auth"
);

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
