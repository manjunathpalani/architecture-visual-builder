import { getICloudMeta, setICloudMeta } from './cloudCredentials'
import { CloudApiError } from './oauth'
import type { CloudItem } from './types'

const DB_NAME = 'architecture-visual-builder-fs'
const STORE = 'handles'
const HANDLE_KEY = 'icloud-folder'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'))
  })
}

async function saveHandle(handle: FileSystemDirectoryHandle) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(handle, HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not store folder access'))
  })
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(HANDLE_KEY)
    request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('Could not read stored folder'))
  })
}

async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  const current = await handle.queryPermission({ mode: 'readwrite' })
  if (current === 'granted') return handle
  const next = await handle.requestPermission({ mode: 'readwrite' })
  if (next !== 'granted') throw new CloudApiError('Folder access was not granted.')
  return handle
}

export function canUseFolderPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function connectICloudFolder(): Promise<string> {
  if (!canUseFolderPicker()) {
    throw new CloudApiError(
      'This browser cannot grant a persistent folder. Use Chrome or Edge, or pick an iCloud Drive folder from Files.',
    )
  }
  const handle = await window.showDirectoryPicker({
    mode: 'readwrite',
    startIn: 'documents',
  })
  await saveHandle(handle)
  setICloudMeta({ name: handle.name, connectedAt: new Date().toISOString() })
  return handle.name
}

export async function disconnectICloudFolder() {
  setICloudMeta(null)
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(HANDLE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Could not clear folder access'))
    })
  } catch {
    /* ignore */
  }
}

export async function listICloudChildren(pathParts: string[] = []): Promise<CloudItem[]> {
  const dir = await getDirectory(pathParts)
  const items: CloudItem[] = []
  for await (const [name, handle] of dir.entries()) {
    items.push({
      id: [...pathParts, name].join('/'),
      name,
      isFolder: handle.kind === 'directory',
    })
  }
  return items.sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name))
}

export async function readICloudFile(pathParts: string[]): Promise<string> {
  if (pathParts.length === 0) throw new CloudApiError('Choose a JSON file.')
  const dir = await getDirectory(pathParts.slice(0, -1))
  const fileHandle = await dir.getFileHandle(pathParts[pathParts.length - 1])
  const file = await fileHandle.getFile()
  return file.text()
}

export async function writeICloudFile(pathParts: string[], fileName: string, content: string): Promise<void> {
  const dir = await getDirectory(pathParts)
  const fileHandle = await dir.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}

async function getDirectory(pathParts: string[]): Promise<FileSystemDirectoryHandle> {
  const stored = await loadHandle()
  if (!stored) {
    const meta = getICloudMeta()
    if (!meta) throw new CloudApiError('Connect an iCloud Drive folder in Settings → Cloud storage first.')
    throw new CloudApiError('Reconnect the iCloud Drive folder. Browser folder access does not survive every restart.')
  }
  let dir = await ensurePermission(stored)
  for (const part of pathParts) {
    dir = await dir.getDirectoryHandle(part)
  }
  return dir
}
