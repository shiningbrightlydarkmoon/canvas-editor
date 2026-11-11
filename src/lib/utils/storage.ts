import type { CanvasElement } from '@/core/types'

const DB_NAME = 'CanvasEditorDB' // IndexedDB 数据库名称
const STORE_NAME = 'canvases' // 对象仓库：整份画布数据
const LEGACY_STORE = 'snapshots' // 旧版本仓库名（仅用于迁移，新代码不再写入）
const DB_VERSION = 2 // v1 用 snapshots，v2 改名 canvases
const DATA_KEY = 'current_canvas' // 单条记录的 key

type CanvasRecord = Record<string, CanvasElement>

/**
 * 打开数据库连接。
 * v2 升级时只新建 canvases 仓库，旧 snapshots 仓库先保留，供 loadFromDB 回退读取。
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

/** 从指定仓库读一条记录 */
const readStore = (db: IDBDatabase, storeName: string): Promise<CanvasRecord | null> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const request = transaction.objectStore(storeName).get(DATA_KEY)
    request.onsuccess = () => resolve((request.result as CanvasRecord) ?? null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * 保存画布数据（整份覆盖）。
 * 注意：调用方传入的必须是普通对象，不能是 Vue 的响应式 Proxy，
 * 否则 IndexedDB 的结构化克隆会抛 DataCloneError。
 */
export const saveToDB = async (data: CanvasRecord): Promise<void> => {
  let opened: IDBDatabase
  try {
    opened = await openDB()
  } catch (err) {
    console.error('IndexedDB 打开失败:', err)
    return
  }

  const db = opened
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(data, DATA_KEY)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } catch (err) {
    console.error('IndexedDB 保存失败:', err)
  } finally {
    // 事务结束就关闭连接，避免长时间持有导致「连接数过多」
    db.close()
  }
}

/**
 * 读取画布数据。
 * 先读新仓库 canvases；读不到说明是旧版本数据，回退读 snapshots 并迁移过来。
 */
export const loadFromDB = async (): Promise<CanvasRecord | null> => {
  let opened: IDBDatabase
  try {
    opened = await openDB()
  } catch (err) {
    console.error('IndexedDB 打开失败:', err)
    return null
  }

  const db = opened
  try {
    const current = await readStore(db, STORE_NAME)
    if (current) return current

    // 迁移旧数据
    if (!db.objectStoreNames.contains(LEGACY_STORE)) return null
    const legacy = await readStore(db, LEGACY_STORE)
    if (legacy) {
      await saveToDB(legacy)
      console.info('[storage] 已把旧仓库 snapshots 的数据迁移到 canvases')
    }
    return legacy
  } catch (err) {
    console.error('IndexedDB 读取失败:', err)
    return null
  } finally {
    db.close()
  }
}
