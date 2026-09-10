/** One-time local file binding via the File System Access API (Chrome / Edge). */

export interface LocalFileHandle {
  readonly name: string
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  createWritable(): Promise<{
    write(data: BufferSource | Blob | string): Promise<void>
    close(): Promise<void>
  }>
}

export interface StoredLocalFile {
  tabId: string
  name: string
  handle: LocalFileHandle
}

const DB_NAME = 'architecture-visual-builder-local-files'
const STORE = 'handles'
const DB_VERSION = 1

const writeQueues = new Map<string, Promise<void>>()

type SavePicker = (options?: {
  suggestedName?: string
  types?: Array<{ description?: string; accept: Record<string, string[]> }>
}) => Promise<LocalFileHandle>

export function isLocalFileSaveSupported(): boolean {
  return typeof window !== 'undefined' && typeof getSavePicker() === 'function'
}

function getSavePicker(): SavePicker | undefined {
  const picker = (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker
  return typeof picker === 'function' ? picker.bind(window) : undefined
}

export function suggestedArchitectureFilename(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug || 'architecture'}.json`
}

export async function pickLocalSaveFile(suggestedName: string): Promise<LocalFileHandle | null> {
  const picker = getSavePicker()
  if (!picker) return null
  try {
    return await picker({
      suggestedName,
      types: [
        {
          description: 'Architecture JSON',
          accept: { 'application/json': ['.json'] },
        },
      ],
    })
  } catch (err) {
    if (isAbort(err)) return null
    throw err
  }
}

export async function queryLocalFilePermission(handle: LocalFileHandle): Promise<PermissionState> {
  try {
    return await handle.queryPermission({ mode: 'readwrite' })
  } catch {
    return 'prompt'
  }
}

export async function requestLocalFilePermission(handle: LocalFileHandle): Promise<PermissionState> {
  try {
    return await handle.requestPermission({ mode: 'readwrite' })
  } catch {
    return 'denied'
  }
}

export async function writeTextFile(handle: LocalFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(text)
  await writable.close()
}

export function writeTextFileQueued(
  tabId: string,
  handle: LocalFileHandle,
  text: string,
): Promise<void> {
  const previous = writeQueues.get(tabId) ?? Promise.resolve()
  const next = previous.then(
    () => writeTextFile(handle, text),
    () => writeTextFile(handle, text),
  )
  writeQueues.set(tabId, next)
  return next
}

export function isAbort(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'AbortError')
  )
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'tabId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local-file database'))
  })
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export async function loadStoredLocalFiles(): Promise<StoredLocalFile[]> {
  try {
    const db = await openDb()
    const rows = await idbRequest(
      db.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<StoredLocalFile[]>,
    )
    db.close()
    return Array.isArray(rows) ? rows.filter((row) => row?.tabId && row.handle && row.name) : []
  } catch {
    return []
  }
}

export async function storeLocalFile(row: StoredLocalFile): Promise<void> {
  const db = await openDb()
  await idbRequest(db.transaction(STORE, 'readwrite').objectStore(STORE).put(row))
  db.close()
}

export async function removeStoredLocalFile(tabId: string): Promise<void> {
  try {
    const db = await openDb()
    await idbRequest(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(tabId))
    db.close()
  } catch {
    /* ignore */
  }
}
