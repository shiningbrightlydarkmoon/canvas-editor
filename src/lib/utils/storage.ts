import type { CanvasElement } from '@/core/types'

const DB_NAME = 'CanvasEditorDB'
const STORE_NAME = 'snapshots'
const DB_VERSION = 1
const DATA_KEY = 'current_canvas'

/**
 * 打开数据库连接
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

/**
 * 保存画布数据 (异步)
 */
export const saveToDB = async (data: Record<string, CanvasElement>): Promise<void> => {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      // 我们把整个 elements 对象作为一个大 JSON 存进去
      // 如果想更高级，可以拆分存储，但 MVP 阶段这样最稳
      const request = store.put(data, DATA_KEY)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('IndexedDB 保存失败:', err)
  }
}

/**
 * 读取画布数据 (异步)
 */
export const loadFromDB = async (): Promise<Record<string, CanvasElement> | null> => {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(DATA_KEY)

      request.onsuccess = () => {
        resolve(request.result || null)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('IndexedDB 读取失败:', err)
    return null
  }
}
