import { openDB, IDBPDatabase } from "idb";

export function createStore<V>(dbName: string, storeName: string) {
  let dbPromise: Promise<IDBPDatabase> | null = null;

  function getDB() {
    if (!dbPromise) {
      dbPromise = openDB(dbName, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
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

  return {
    async get(key: string): Promise<V | undefined> {
      const db = await getDB();
      return db.get(storeName, key);
    },
    async put(key: string, value: V): Promise<void> {
      const db = await getDB();
      await db.put(storeName, value, key);
    },
    async delete(key: string): Promise<void> {
      const db = await getDB();
      await db.delete(storeName, key);
    },
  };
}
