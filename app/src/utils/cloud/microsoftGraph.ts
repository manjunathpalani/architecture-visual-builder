import { getMicrosoftTokens, setMicrosoftTokens } from './cloudCredentials'
import { CloudApiError, refreshMicrosoftAccess } from './oauth'
import type { CloudItem } from './types'

interface GraphUser {
  displayName?: string
  mail?: string
  userPrincipalName?: string
}

interface GraphItem {
  id: string
  name: string
  folder?: { childCount?: number }
  file?: { mimeType?: string }
}

interface GraphSite {
  id: string
  displayName?: string
  name?: string
  webUrl?: string
}

export async function testMicrosoftConnection(): Promise<{ name: string; email: string }> {
  const me = await graphFetch<GraphUser>('/v1.0/me')
  const name = me.displayName || 'Microsoft 365 user'
  const email = me.mail || me.userPrincipalName || ''
  const current = getMicrosoftTokens()
  if (current) setMicrosoftTokens({ ...current, name, email })
  return { name, email }
}

export async function listOneDriveChildren(itemId?: string): Promise<CloudItem[]> {
  const path = itemId
    ? `/v1.0/me/drive/items/${encodeURIComponent(itemId)}/children`
    : '/v1.0/me/drive/root/children'
  const result = await graphFetch<{ value: GraphItem[] }>(`${path}?$top=80&$select=id,name,folder,file`)
  return (result.value ?? []).map(mapItem)
}

export async function listSharePointSites(query = '*'): Promise<Array<{ id: string; name: string }>> {
  const sites: Array<{ id: string; name: string }> = []
  try {
    const root = await graphFetch<GraphSite>('/v1.0/sites/root')
    if (root.id) sites.push({ id: root.id, name: root.displayName || root.name || 'Root site' })
  } catch {
    /* tenant may hide root */
  }
  try {
    const followed = await graphFetch<{ value: GraphSite[] }>('/v1.0/me/followedSites')
    for (const site of followed.value ?? []) {
      if (site.id && !sites.some((s) => s.id === site.id)) {
        sites.push({ id: site.id, name: site.displayName || site.name || site.webUrl || site.id })
      }
    }
  } catch {
    /* optional */
  }
  if (query.trim() && query.trim() !== '*') {
    const searched = await graphFetch<{ value: GraphSite[] }>(
      `/v1.0/sites?search=${encodeURIComponent(query.trim())}`,
    )
    for (const site of searched.value ?? []) {
      if (site.id && !sites.some((s) => s.id === site.id)) {
        sites.push({ id: site.id, name: site.displayName || site.name || site.webUrl || site.id })
      }
    }
  }
  return sites
}

export async function listSharePointChildren(siteId: string, itemId?: string): Promise<CloudItem[]> {
  const path = itemId
    ? `/v1.0/sites/${encodeURIComponent(siteId)}/drive/items/${encodeURIComponent(itemId)}/children`
    : `/v1.0/sites/${encodeURIComponent(siteId)}/drive/root/children`
  const result = await graphFetch<{ value: GraphItem[] }>(`${path}?$top=80&$select=id,name,folder,file`)
  return (result.value ?? []).map(mapItem)
}

export async function readOneDriveFile(itemId: string): Promise<string> {
  return readDriveContent(`/v1.0/me/drive/items/${encodeURIComponent(itemId)}/content`)
}

export async function readSharePointFile(siteId: string, itemId: string): Promise<string> {
  return readDriveContent(
    `/v1.0/sites/${encodeURIComponent(siteId)}/drive/items/${encodeURIComponent(itemId)}/content`,
  )
}

export async function writeOneDriveFile(folderId: string | undefined, fileName: string, content: string): Promise<void> {
  const target = folderId
    ? `/v1.0/me/drive/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(fileName)}:/content`
    : `/v1.0/me/drive/root:/${encodeURIComponent(fileName)}:/content`
  await putContent(target, content)
}

export async function writeSharePointFile(
  siteId: string,
  folderId: string | undefined,
  fileName: string,
  content: string,
): Promise<void> {
  const target = folderId
    ? `/v1.0/sites/${encodeURIComponent(siteId)}/drive/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(fileName)}:/content`
    : `/v1.0/sites/${encodeURIComponent(siteId)}/drive/root:/${encodeURIComponent(fileName)}:/content`
  await putContent(target, content)
}

function mapItem(item: GraphItem): CloudItem {
  return {
    id: item.id,
    name: item.name,
    isFolder: Boolean(item.folder),
    mimeType: item.file?.mimeType,
  }
}

async function readDriveContent(path: string): Promise<string> {
  const token = await refreshMicrosoftAccess()
  const response = await fetch(`/api/graph${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new CloudApiError(await graphError(response), response.status)
  }
  return response.text()
}

async function putContent(path: string, content: string): Promise<void> {
  const token = await refreshMicrosoftAccess()
  const response = await fetch(`/api/graph${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: content,
  })
  if (!response.ok) {
    throw new CloudApiError(await graphError(response), response.status)
  }
}

async function graphFetch<T>(path: string): Promise<T> {
  const token = await refreshMicrosoftAccess()
  const response = await fetch(`/api/graph${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new CloudApiError(await graphError(response), response.status)
  }
  return response.json() as Promise<T>
}

async function graphError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    return body.error?.message || `Microsoft Graph request failed (${response.status})`
  } catch {
    return `Microsoft Graph request failed (${response.status})`
  }
}
