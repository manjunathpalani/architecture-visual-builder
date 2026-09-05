import { getGoogleBucket, getGoogleTokens, setGoogleTokens } from './cloudCredentials'
import { CloudApiError, refreshGoogleAccess } from './oauth'
import type { CloudItem } from './types'

interface GoogleUser {
  name?: string
  email?: string
}

interface DriveFile {
  id: string
  name: string
  mimeType?: string
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export async function testGoogleConnection(): Promise<{ name: string; email: string }> {
  const me = await gapiFetch<GoogleUser>('/oauth2/v2/userinfo')
  const name = me.name || 'Google user'
  const email = me.email || ''
  const current = getGoogleTokens()
  if (current) setGoogleTokens({ ...current, name, email })
  return { name, email }
}

export async function listGoogleDriveChildren(folderId?: string): Promise<CloudItem[]> {
  const parent = folderId || 'root'
  const params = new URLSearchParams({
    q: `'${parent.replace(/'/g, "\\'")}' in parents and trashed = false`,
    pageSize: '80',
    fields: 'files(id,name,mimeType)',
    spaces: 'drive',
  })
  const result = await gapiFetch<{ files?: DriveFile[] }>(`/drive/v3/files?${params}`)
  return (result.files ?? []).map((file) => ({
    id: file.id,
    name: file.name,
    isFolder: file.mimeType === FOLDER_MIME,
    mimeType: file.mimeType,
  }))
}

export async function readGoogleDriveFile(fileId: string): Promise<string> {
  const token = await refreshGoogleAccess()
  const response = await fetch(`/api/gapi/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new CloudApiError(await googleError(response), response.status)
  return response.text()
}

export async function writeGoogleDriveFile(
  folderId: string | undefined,
  fileName: string,
  content: string,
): Promise<void> {
  const existing = await findDriveFile(folderId, fileName)
  if (existing) {
    const token = await refreshGoogleAccess()
    const response = await fetch(`/api/gapi/upload/drive/v3/files/${encodeURIComponent(existing)}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: content,
    })
    if (!response.ok) throw new CloudApiError(await googleError(response), response.status)
    return
  }

  const metadata: Record<string, unknown> = {
    name: fileName,
    mimeType: 'application/json',
  }
  if (folderId && folderId !== 'root') metadata.parents = [folderId]

  const token = await refreshGoogleAccess()
  const boundary = `avb_${Date.now()}`
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n')

  const response = await fetch('/api/gapi/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  if (!response.ok) throw new CloudApiError(await googleError(response), response.status)
}

async function findDriveFile(folderId: string | undefined, fileName: string): Promise<string | null> {
  const parent = folderId || 'root'
  const escaped = fileName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const params = new URLSearchParams({
    q: `'${parent.replace(/'/g, "\\'")}' in parents and name = '${escaped}' and trashed = false`,
    fields: 'files(id,name)',
    pageSize: '1',
  })
  const result = await gapiFetch<{ files?: DriveFile[] }>(`/drive/v3/files?${params}`)
  return result.files?.[0]?.id ?? null
}

export async function listGcsObjects(prefix = ''): Promise<CloudItem[]> {
  const bucket = requireBucket()
  const params = new URLSearchParams({ delimiter: '/', maxResults: '80' })
  if (prefix) params.set('prefix', prefix.endsWith('/') ? prefix : `${prefix}/`)
  const result = await gapiFetch<{
    items?: Array<{ name: string }>
    prefixes?: string[]
  }>(`/storage/v1/b/${encodeURIComponent(bucket)}/o?${params}`)
  const folders = (result.prefixes ?? []).map((name) => ({
    id: name,
    name: name.replace(prefix, '').replace(/\/$/, ''),
    isFolder: true,
  }))
  const files = (result.items ?? [])
    .filter((item) => item.name !== prefix)
    .map((item) => ({
      id: item.name,
      name: item.name.split('/').pop() || item.name,
      isFolder: false,
    }))
  return [...folders, ...files]
}

export async function readGcsObject(objectName: string): Promise<string> {
  const bucket = requireBucket()
  const token = await refreshGoogleAccess()
  const response = await fetch(
    `/api/gapi/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!response.ok) throw new CloudApiError(await googleError(response), response.status)
  return response.text()
}

export async function writeGcsObject(objectName: string, content: string): Promise<void> {
  const bucket = requireBucket()
  const token = await refreshGoogleAccess()
  const response = await fetch(
    `/api/gapi/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: content,
    },
  )
  if (!response.ok) throw new CloudApiError(await googleError(response), response.status)
}

function requireBucket(): string {
  const bucket = getGoogleBucket()
  if (!bucket) throw new CloudApiError('Enter a Google Cloud Storage bucket name in Settings → Cloud storage.')
  return bucket
}

async function gapiFetch<T>(path: string): Promise<T> {
  const token = await refreshGoogleAccess()
  const response = await fetch(`/api/gapi${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!response.ok) throw new CloudApiError(await googleError(response), response.status)
  return response.json() as Promise<T>
}

async function googleError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } | string }
    if (typeof body.error === 'string') return body.error
    return body.error?.message || `Google request failed (${response.status})`
  } catch {
    return `Google request failed (${response.status})`
  }
}
