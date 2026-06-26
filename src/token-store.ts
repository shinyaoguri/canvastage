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
      // 永続化はベストエフォート。IndexedDB が使えない環境（Safari プライベート
      // ブラウジング等）でも、その場の認証フローは成立しているので失敗しても投げず、
      // getStoredToken と同じ「握り潰す」契約に揃える。
      try {
        await store.put(tokenKey, { token, createdAt: Date.now() });
      } catch (e) {
        console.warn(
          "トークンの保存に失敗しました（この環境では永続化されません）",
          e
        );
      }
    },
    async clearToken(): Promise<void> {
      try {
        await store.delete(tokenKey);
      } catch (e) {
        console.warn("トークンの削除に失敗しました", e);
      }
    },
  };
}
