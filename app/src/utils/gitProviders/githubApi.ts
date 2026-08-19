import { getGitHubCredentials } from '../gitCredentials'
import { GitApiError, fromBase64Utf8, gitFetch, toBase64Utf8 } from './apiClient'

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  default_branch: string
  html_url: string
  private: boolean
}

export interface GitHubBranch {
  name: string
}

export interface GitHubContentItem {
  name: string
  path: string
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  sha: string
  size?: number
}

function getHeaders(): Record<string, string> {
  const creds = getGitHubCredentials()
  if (!creds?.token) throw new GitApiError('GitHub not connected', 401)
  return {
    Authorization: `Bearer ${creds.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

export async function testGitHubConnection(): Promise<{ username: string }> {
  const user = await gitFetch<{ login: string }>('/api/github/user', getHeaders())
  return { username: user.login }
}

export async function listGitHubRepos(): Promise<GitHubRepo[]> {
  return gitFetch<GitHubRepo[]>(
    '/api/github/user/repos?per_page=100&sort=updated',
    getHeaders(),
  )
}

export async function listGitHubBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
  return gitFetch<GitHubBranch[]>(
    `/api/github/repos/${owner}/${repo}/branches?per_page=100`,
    getHeaders(),
  )
}

export async function listGitHubContents(
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<GitHubContentItem[]> {
  const encodedPath = path ? encodeURIComponent(path).replace(/%2F/g, '/') : ''
  const url = `/api/github/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
  const result = await gitFetch<GitHubContentItem | GitHubContentItem[]>(url, getHeaders())
  return Array.isArray(result) ? result : [result]
}

export async function readGitHubFile(
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<string> {
  const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/')
  const file = await gitFetch<{ content: string; encoding: string }>(
    `/api/github/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
    getHeaders(),
  )
  if (file.encoding !== 'base64') throw new GitApiError('Unsupported file encoding', 400)
  return fromBase64Utf8(file.content.replace(/\n/g, ''))
}

export async function writeGitHubFile(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  content: string,
  message: string,
): Promise<void> {
  const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/')
  let sha: string | undefined

  try {
    const existing = await gitFetch<{ sha: string }>(
      `/api/github/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
      getHeaders(),
    )
    sha = existing.sha
  } catch (err) {
    if (!(err instanceof GitApiError) || err.status !== 404) throw err
  }

  const response = await fetch(`/api/github/repos/${owner}/${repo}/contents/${encodedPath}`, {
    method: 'PUT',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: toBase64Utf8(content),
      branch,
      ...(sha ? { sha } : {}),
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new GitApiError(body.message ?? 'Failed to push file', response.status)
  }
}