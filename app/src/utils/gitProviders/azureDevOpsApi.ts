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