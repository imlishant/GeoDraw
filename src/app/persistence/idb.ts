// Minimal IndexedDB wrapper (no dependency). Every call degrades gracefully:
// private windows or blocked storage just mean "nothing saved".

const DB_NAME = 'drawgeo';
const VERSION = 1;
export type StoreName = 'docs' | 'progress';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'problemId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idbGet = <T>(store: StoreName, key: string) => run<T | undefined>(store, 'readonly', (s) => s.get(key));
export const idbAll = <T>(store: StoreName) => run<T[]>(store, 'readonly', (s) => s.getAll());
export const idbPut = <T>(store: StoreName, value: T) => run<IDBValidKey>(store, 'readwrite', (s) => s.put(value));
export const idbDelete = (store: StoreName, key: string) => run<undefined>(store, 'readwrite', (s) => s.delete(key));
