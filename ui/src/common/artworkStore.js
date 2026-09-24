// Persistent IndexedDB-based store for artwork blobs.
// Enables 0ms instant loads from device flash storage across app restarts (especially in the Android APK).

const DB_NAME = 'bragi-artwork-cache'
const DB_VERSION = 1
const STORE_NAME = 'blobs'
const MAX_STORED_ENTRIES = 2000
const PRUNE_BATCH_SIZE = 200

let dbPromise = null

const isIndexedDBSupported = () => {
  try {
    return (
      typeof window !== 'undefined' &&
      'indexedDB' in window &&
      window.indexedDB !== null
    )
  } catch {
    return false
  }
}

const getDB = () => {
  if (!isIndexedDBSupported()) {
    return Promise.resolve(null)
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION)

        request.onupgradeneeded = (event) => {
          const db = event.target.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
            store.createIndex('timestamp', 'timestamp', { unique: false })
          }
        }

        request.onsuccess = (event) => {
          resolve(event.target.result)
        }

        request.onerror = () => {
          resolve(null)
        }
      } catch {
        resolve(null)
      }
    })
  }
  return dbPromise
}

/**
 * Retrieve a cached image Blob by canonical key from IndexedDB.
 * @param {string} key
 * @returns {Promise<Blob|null>}
 */
export const getArtworkBlob = async (key) => {
  if (!key) return null
  try {
    const db = await getDB()
    if (!db) return null

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.get(key)

        req.onsuccess = () => {
          if (req.result && req.result.blob) {
            resolve(req.result.blob)
          } else {
            resolve(null)
          }
        }

        req.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  } catch {
    return null
  }
}

let writeCount = 0

/**
 * Save an image Blob to IndexedDB by canonical key.
 * @param {string} key
 * @param {Blob} blob
 * @returns {Promise<void>}
 */
export const setArtworkBlob = async (key, blob) => {
  if (!key || !blob) return
  try {
    const db = await getDB()
    if (!db) return

    await new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        store.put({
          key,
          blob,
          timestamp: Date.now(),
        })
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
        tx.onabort = () => resolve()
      } catch {
        resolve()
      }
    })

    writeCount++
    if (writeCount % 50 === 0) {
      pruneOldEntries(db)
    }
  } catch {
    // Graceful silent fallback
  }
}

/**
 * Prune oldest entries when database exceeds MAX_STORED_ENTRIES.
 */
const pruneOldEntries = async (db) => {
  if (!db) return
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const countReq = store.count()

    countReq.onsuccess = () => {
      const count = countReq.result
      if (count > MAX_STORED_ENTRIES) {
        const index = store.index('timestamp')
        const cursorReq = index.openCursor()
        let deleted = 0

        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result
          if (cursor && deleted < PRUNE_BATCH_SIZE) {
            cursor.delete()
            deleted++
            cursor.continue()
          }
        }
      }
    }
  } catch {
    // Ignore pruning errors
  }
}

/**
 * Delete a specific artwork blob.
 */
export const deleteArtworkBlob = async (key) => {
  if (!key) return
  try {
    const db = await getDB()
    if (!db) return
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
  } catch {
    // Ignore
  }
}

/**
 * Clear the entire artwork cache.
 */
export const clearArtworkCache = async () => {
  try {
    const db = await getDB()
    if (!db) return
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
  } catch {
    // Ignore
  }
}
