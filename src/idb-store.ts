import { openDB, IDBPDatabase } from "idb";

export interface KVStore<V> {
  get(key: string): Promise<V | undefined>;
  put(key: string, value: V): Promise<void>;
  delete(key: string): Promise<void>;
  getAll(): Promise<V[]>;
}

/**
 * 1 つの DB に複数の objectStore をまとめて作る。
 *
 * ⚠️ 同じ DB 名に対して createStore / createStores を 2 回呼んではいけない。
 * バージョンは 1 固定で、IndexedDB の upgrade はバージョンが上がったときにしか
 * 走らない。既にその DB が v1 で存在するユーザーの環境では 2 回目の upgrade が
 * 発火せず、後から足した objectStore が作られないまま開かれて、以降の
 * get/put/delete が NotFoundError で落ち続ける。新規ユーザーでは再現しないため
 * ローカル開発では気づけない。同一 DB の複数ストアは必ずこの API で一度に宣言し、
 * 別の関心事なら別の DB 名にすること。
 */
export function createStores<M extends Record<string, unknown>>(
  dbName: string,
  storeNames: readonly (keyof M & string)[]
): { [K in keyof M & string]: KVStore<M[K]> } {
  let dbPromise: Promise<IDBPDatabase> | null = null;

  function getDB() {
    if (!dbPromise) {
      dbPromise = openDB(dbName, 1, {
        upgrade(db) {
          for (const name of storeNames) {
            if (!db.objectStoreNames.contains(name)) {
              db.createObjectStore(name);
            }
          }
        },
      });
      // openDB が失敗（Safari プライベートブラウジング等で IndexedDB 無効）した場合、
      // 拒否済み Promise を握り続けると以降の get/put/delete が永久に同じ失敗を
      // 再利用してしまう。reject 時はキャッシュを捨てて次回リトライ可能にする。
      dbPromise.catch(() => {
        dbPromise = null;
      });
    }
    return dbPromise;
  }

  const stores = {} as { [K in keyof M & string]: KVStore<M[K]> };
  for (const storeName of storeNames) {
    stores[storeName] = {
      async get(key: string) {
        const db = await getDB();
        return db.get(storeName, key);
      },
      async put(key: string, value: M[typeof storeName]) {
        const db = await getDB();
        await db.put(storeName, value, key);
      },
      async delete(key: string) {
        const db = await getDB();
        await db.delete(storeName, key);
      },
      async getAll() {
        const db = await getDB();
        return db.getAll(storeName);
      },
    };
  }
  return stores;
}

/** 単一ストア用の従来 API（createStores の薄いラッパ）。 */
export function createStore<V>(dbName: string, storeName: string): KVStore<V> {
  return createStores<Record<string, V>>(dbName, [storeName])[storeName];
}
