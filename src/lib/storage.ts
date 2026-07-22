// IndexedDB 存储工具：主存储 IndexedDB（大容量），备份 localStorage（快速回退）

const DB_NAME = 'ai_novel_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn(`IndexedDB 写入失败：${key}`, error);
  }
}

// localStorage 辅助
function lsGet<T>(key: string): T | null {
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

function lsSet<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`localStorage 写入失败：${key}`, error);
  }
}

// 双层读取：优先 IndexedDB，回退 localStorage
export async function dualGet<T>(key: string, fallback: T): Promise<T> {
  const idbVal = await idbGet<T>(key);
  if (idbVal !== null) return idbVal;
  const lsVal = lsGet<T>(key);
  if (lsVal !== null) return lsVal;
  return fallback;
}

// 双层写入：同时写 IndexedDB + localStorage
export function dualSet<T>(key: string, value: T): void {
  lsSet(key, value);   // 同步写 localStorage（快速回退）
  idbSet(key, value);  // 异步写 IndexedDB（大容量主存储）
}

// 删除单个键：IndexedDB + localStorage
export async function dualDelete(key: string): Promise<void> {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`localStorage 删除失败：${key}`, error);
  }
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn(`IndexedDB 删除失败：${key}`, error);
  }
}

// 清空全部本机创作数据（IndexedDB store + 相关 localStorage）
export async function dualClearAll(options?: { keepSettings?: boolean }): Promise<void> {
  const keepSettings = options?.keepSettings ?? false;
  const keepKeys = new Set(
    keepSettings
      ? ['ai_novel_settings', 'ai_novel_mode']
      : []
  );

  // localStorage：删掉 ai_novel_* 与其它已知前缀
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (keepKeys.has(k)) continue;
      if (
        k.startsWith('ai_novel_') ||
        k.startsWith('free_key_') ||
        k === 'failedKeys' ||
        k === 'currentKeyIndex'
      ) {
        toRemove.push(k);
      }
    }
    toRemove.forEach(k => window.localStorage.removeItem(k));
    if (!keepSettings) {
      // 完全重置时额外 clear 一遍，避免遗漏
      // 但若 keepSettings 为 true 则不能 clear
    } else {
      // keep settings: already selective
    }
  } catch (error) {
    console.warn('localStorage 清理失败', error);
  }

  if (!keepSettings) {
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  }

  // IndexedDB：清空 store 或选择性删除
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      if (!keepSettings) {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } else {
        const req = store.getAllKeys();
        req.onsuccess = () => {
          const keys = (req.result as IDBValidKey[]) || [];
          let pending = keys.length;
          if (pending === 0) {
            resolve();
            return;
          }
          keys.forEach(key => {
            const keyStr = String(key);
            if (keepKeys.has(keyStr)) {
              pending -= 1;
              if (pending === 0) resolve();
              return;
            }
            const del = store.delete(key);
            del.onsuccess = () => {
              pending -= 1;
              if (pending === 0) resolve();
            };
            del.onerror = () => reject(del.error);
          });
        };
        req.onerror = () => reject(req.error);
      }
    });
  } catch (error) {
    console.warn('IndexedDB 清空失败', error);
  }
}

