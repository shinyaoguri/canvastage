import { createStore } from "./idb-store";

// GitHub / OpenProcessing のトークンは同じ IndexedDB（canvastage-auth / auth）に
// 別キーで保存する。両者で同一だった get/store/clear のロジックをここに集約する。
interface TokenRecord {
  token: string;
  createdAt: number;
  // そのトークンの持ち主（GitHub は login、OpenProcessing は username）。
  // トークンと同一レコードに置くことで、storeToken の上書き・clearToken の削除に
  // 自動で追従する。別キーに分けると「別アカウントのトークンに差し替わったのに
  // 名前だけ古いまま」という不整合が作れてしまうので、必ずここに同居させる。
  login?: string;
  loginFetchedAt?: number;
}

// アカウントのリネームに追従するため、持ち主の名前は 24 時間で取り直す。
const IDENTITY_TTL_MS = 24 * 60 * 60 * 1000;

const store = createStore<TokenRecord>("canvastage-auth", "auth");

export interface TokenStore {
  getStoredToken(): Promise<string | null>;
  storeToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
  /** キャッシュ済みの持ち主の名前。未取得・期限切れ・失敗はすべて null。 */
  getStoredIdentity(): Promise<string | null>;
  setStoredIdentity(login: string): Promise<void>;
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
    async getStoredIdentity(): Promise<string | null> {
      try {
        const record = await store.get(tokenKey);
        if (!record?.login || !record.loginFetchedAt) return null;
        if (Date.now() - record.loginFetchedAt > IDENTITY_TTL_MS) return null;
        return record.login;
      } catch {
        return null;
      }
    },
    async setStoredIdentity(login: string): Promise<void> {
      try {
        const record = await store.get(tokenKey);
        // トークンが無ければ書かない（削除済みのキーに孤立した名前を残さない）。
        if (!record) return;
        await store.put(tokenKey, {
          ...record,
          login,
          loginFetchedAt: Date.now(),
        });
      } catch (e) {
        console.warn("ログイン名の保存に失敗しました", e);
      }
    },
  };
}
