import { getAzureDevOpsCredentials } from '../gitCredentials'
import { GitApiError, gitFetch } from './apiClient'

export interface AzureProject {
  id: string
  name: string
}

export interface AzureRepo {
  id: string
  name: string
  defaultBranch: string
  remoteUrl: string
  project: { name: string }
}

export interface AzureBranch {
  name: string
}

export interface AzureItem {
  path: string
  isFolder: boolean
  gitObjectType: 'blob' | 'tree'
  size?: number
}

function getOrg(): string {
  const creds = getAzureDevOpsCredentials()
  if (!creds?.organization || !creds?.token) {
    throw new GitApiError('Azure DevOps not connected', 401)
  }
  return creds.organization
}

function getHeaders(): Record<string, string> {
  const creds = getAzureDevOpsCredentials()
  if (!creds?.token) throw new GitApiError('Azure DevOps not connected', 401)
  const encoded = btoa(`:${creds.token}`)
  return {
    Authorization: `Basic ${encoded}`,
    Accept: 'application/json',
  }
}

function azureUrl(path: string): string {
  return `/api/azure/${getOrg()}${path}`
}

export async function testAzureDevOpsConnection(): Promise<{ organization: string }> {
  await gitFetch(azureUrl('/_apis/projects?$top=1&api-version=7.0'), getHeaders())
  return { organization: getOrg() }
}

export async function listAzureProjects(): Promise<AzureProject[]> {
  const result = await gitFetch<{ value: AzureProject[] }>(
    azureUrl('/_apis/projects?api-version=7.0'),
    getHeaders(),
  )
  return result.value
}

export async function listAzureRepos(project: string): Promise<AzureRepo[]> {
  const result = await gitFetch<{ value: AzureRepo[] }>(
    azureUrl(`/${encodeURIComponent(project)}/_apis/git/repositories?api-version=7.0`),
    getHeaders(),
  )
  return result.value
}

export async function listAzureBranches(project: string, repoId: string): Promise<AzureBranch[]> {
  const result = await gitFetch<{ value: { name: string }[] }>(
    azureUrl(
      `/${encodeURIComponent(project)}/_apis/git/repositories/${repoId}/refs?filter=heads/&api-version=7.0`,
    ),
    getHeaders(),
  )
  return result.value.map((r) => ({ name: r.name.replace('refs/heads/', '') }))
}

export async function listAzureItems(
  project: string,
  repoId: string,
  path: string,
  branch: string,
): Promise<AzureItem[]> {
  const params = new URLSearchParams({
    scopePath: path || '/',
    recursionLevel: 'OneLevel',
    'versionDescriptor.version': branch,
    'versionDescriptor.versionType': 'branch',
    'api-version': '7.0',
  })
  const result = await gitFetch<{ value: AzureItem[] }>(
    azureUrl(
      `/${encodeURIComponent(project)}/_apis/git/repositories/${repoId}/items?${params}`,
    ),
    getHeaders(),
  )
  return result.value.filter((item) => item.path !== path && item.path !== `${path}/`)
}

export async function readAzureFile(
  project: string,
  repoId: string,
  path: string,
  branch: string,
): Promise<string> {
  const params = new URLSearchParams({
    path,
    'versionDescriptor.version': branch,
    'versionDescriptor.versionType': 'branch',
    'api-version': '7.0',
    includeContent: 'true',
  })
  const result = await gitFetch<{ content: string }>(
    azureUrl(
      `/${encodeURIComponent(project)}/_apis/git/repositories/${repoId}/items?${params}`,
    ),
    getHeaders(),
  )
  return result.content
}

export async function writeAzureFile(
  project: string,
  repoId: string,
  path: string,
  branch: string,
  content: string,
  message: string,
): Promise<void> {
  const params = 'api-version=7.0'
  const url = azureUrl(
    `/${encodeURIComponent(project)}/_apis/git/repositories/${repoId}/pushes?${params}`,
  )

  let changeType: 'add' | 'edit' = 'add'
  try {
    await readAzureFile(project, repoId, path, branch)
    changeType = 'edit'
  } catch (err) {
    if (!(err instanceof GitApiError) || err.status !== 404) {
      // Azure may return other errors for missing files — default to add
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refUpdates: [{ name: `refs/heads/${branch}`, oldObjectId: await getBranchObjectId(project, repoId, branch) }],
      commits: [
        {
          comment: message,
          changes: [
            {
              changeType,
              item: { path },
              newContent: { content, contentType: 'rawtext' },
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new GitApiError(body.message ?? 'Failed to push to Azure DevOps', response.status)
  }
}

export interface AzureWorkItem {
  id: number
  title: string
  state: string
  type: string
  assignedTo?: string
  project: string
  url: string
}

export async function searchAzureWorkItems(project: string, query?: string): Promise<AzureWorkItem[]> {
  const trimmed = query?.trim() ?? ''
  const escapedProject = escapeWiql(project)
  let wiql: string

  if (trimmed && /^\d+$/.test(trimmed)) {
    wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapedProject}' AND [System.Id] = ${trimmed}`
  } else if (trimmed) {
    wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapedProject}' AND [System.Title] CONTAINS '${escapeWiql(trimmed)}' ORDER BY [System.ChangedDate] DESC`
  } else {
    wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapedProject}' ORDER BY [System.ChangedDate] DESC`
  }

  const response = await fetch(
    azureUrl(`/${encodeURIComponent(project)}/_apis/wit/wiql?$top=40&api-version=7.0`),
    {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: wiql }),
    },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message =
      (body as { message?: string }).message ??
      'Failed to search Azure DevOps work items. Ensure the PAT has Work Items (Read).'
    throw new GitApiError(message, response.status)
  }

  const result = (await response.json()) as { workItems?: Array<{ id: number }> }
  const ids = (result.workItems ?? []).map((item) => item.id).slice(0, 40)
  if (ids.length === 0) return []
  return getAzureWorkItems(ids, project)
}

async function getAzureWorkItems(ids: number[], fallbackProject: string): Promise<AzureWorkItem[]> {
  const params = new URLSearchParams({
    ids: ids.join(','),
    fields:
      'System.Id,System.Title,System.State,System.WorkItemType,System.TeamProject,System.AssignedTo',
    'api-version': '7.0',
  })
  const result = await gitFetch<{ value: AzureWorkItemRaw[] }>(
    azureUrl(`/_apis/wit/workitems?${params}`),
    getHeaders(),
  )
  return result.value.map((item) => mapWorkItem(item, fallbackProject))
}

interface AzureWorkItemRaw {
  id: number
  fields?: {
    'System.Title'?: string
    'System.State'?: string
    'System.WorkItemType'?: string
    'System.TeamProject'?: string
    'System.AssignedTo'?: string | { displayName?: string }
  }
}

function mapWorkItem(item: AzureWorkItemRaw, fallbackProject: string): AzureWorkItem {
  const project = item.fields?.['System.TeamProject'] ?? fallbackProject
  const assigned = item.fields?.['System.AssignedTo']
  return {
    id: item.id,
    title: item.fields?.['System.Title'] ?? '',
    state: item.fields?.['System.State'] ?? '',
    type: item.fields?.['System.WorkItemType'] ?? '',
    assignedTo: typeof assigned === 'string' ? assigned : assigned?.displayName,
    project,
    url: `https://dev.azure.com/${getOrg()}/${encodeURIComponent(project)}/_workitems/edit/${item.id}`,
  }
}

function escapeWiql(value: string): string {
  return value.replace(/'/g, "''")
}

async function getBranchObjectId(
  project: string,
  repoId: string,
  branch: string,
): Promise<string> {
  const result = await gitFetch<{ value: { objectId: string }[] }>(
    azureUrl(
      `/${encodeURIComponent(project)}/_apis/git/repositories/${repoId}/refs?filter=heads/${branch}&api-version=7.0`,
    ),
    getHeaders(),
  )
  const ref = result.value[0]
  if (!ref) throw new GitApiError(`Branch ${branch} not found`, 404)
  return ref.objectId
}