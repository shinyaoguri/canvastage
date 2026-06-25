import { createStore } from "./idb-store";

// GitHub / OpenProcessing のトークンは同じ IndexedDB（canvastage-auth / auth）に
// 別キーで保存する。両者で同一だった get/store/clear のロジックをここに集約する。
interface TokenRecord {
  token: string;
  createdAt: number;
}

const store = createStore<TokenRecord>("canvastage-auth", "auth");

export interface TokenStore {
  getStoredToken(): Promise<string | null>;
  storeToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
}

// 指定キーに紐づくトークンの読み書きを行う facade を返す。
export function makeTokenStore(tokenKey: string): TokenStore {
  return {
    async getStoredToken(): Promise<string | null> {
      try {
        const record = await store.get(tokenKey);
        return record?.token ?? null;
      } catch {
        return null;
      }
    },
    async storeToken(token: string): Promise<void> {
      await store.put(tokenKey, { token, createdAt: Date.now() });
    },
    async clearToken(): Promise<void> {
      await store.delete(tokenKey);
    },
  };
}
