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
