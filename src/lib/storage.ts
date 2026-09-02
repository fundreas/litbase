/**
 * localStorage that never throws.
 *
 * Safari in private mode, storage-blocking browser settings and full quotas all
 * make `localStorage` throw on access, which would otherwise take the whole app
 * down at startup. Every read returns `null` on failure; every write reports
 * whether it landed.
 */

function safeLocalStorage(): Storage | null {
  try {
    const probeKey = '__litbase_probe__'
    window.localStorage.setItem(probeKey, '1')
    window.localStorage.removeItem(probeKey)
    return window.localStorage
  } catch {
    return null
  }
}

const store = safeLocalStorage()

export function readJson<T>(key: string): T | null {
  if (!store) return null
  try {
    const raw = store.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): boolean {
  if (!store) return false
  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function readString(key: string): string | null {
  if (!store) return null
  try {
    return store.getItem(key)
  } catch {
    return null
  }
}

export function writeString(key: string, value: string): boolean {
  if (!store) return false
  try {
    store.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function remove(key: string): void {
  if (!store) return
  try {
    store.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** True when persistence is unavailable — the UI can warn about it. */
export const storageAvailable = store !== null
