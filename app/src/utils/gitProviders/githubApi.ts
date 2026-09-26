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

export async function listGitHubTree(
  owner: string,
  repo: string,
  ref: string,
): Promise<Array<{ path: string; type: string; size?: number }>> {
  const result = await gitFetch<{ tree?: Array<{ path: string; type: string; size?: number }> }>(
    `/api/github/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    getHeaders(),
  )
  return result.tree ?? []
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

export interface CopilotAgentIssue {
  number: number
  htmlUrl: string
  title: string
}

export async function createCopilotAgentIssue(options: {
  owner: string
  repo: string
  title: string
  body: string
  branch?: string
  customInstructions?: string
}): Promise<CopilotAgentIssue> {
  const title = options.title.trim().slice(0, 240) || 'Architecture agent task'
  const body = options.body.length > 60_000 ? `${options.body.slice(0, 59_500)}\n\n…(truncated)` : options.body
  const target = `${options.owner}/${options.repo}`
  const branch = options.branch?.trim() || 'main'
  const headers = {
    ...getHeaders(),
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const agentAssignment = {
    target_repo: target,
    base_branch: branch,
    custom_instructions: options.customInstructions?.trim() || '',
    custom_agent: '',
    model: '',
  }

  const attempts: Array<Record<string, unknown>> = [
    {
      title,
      body,
      assignees: ['copilot-swe-agent[bot]'],
      agent_assignment: agentAssignment,
    },
    {
      title,
      body,
      agent_assignment: agentAssignment,
    },
    {
      title,
      body,
      assignees: ['copilot'],
    },
    { title, body },
  ]

  let lastError: GitApiError | null = null
  for (const payload of attempts) {
    const response = await fetch(`/api/github/repos/${options.owner}/${options.repo}/issues`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      const issue = (await response.json()) as { number: number; html_url: string; title: string }
      if (!payload.assignees && !payload.agent_assignment) {
        await assignCopilotToIssue(options.owner, options.repo, issue.number, branch).catch(() => undefined)
      }
      return { number: issue.number, htmlUrl: issue.html_url, title: issue.title }
    }
    const errBody = (await response.json().catch(() => ({}))) as { message?: string }
    lastError = new GitApiError(errBody.message ?? 'Failed to create GitHub issue', response.status)
    if (response.status !== 422 && response.status !== 400) throw lastError
  }
  throw lastError ?? new GitApiError('Failed to create GitHub issue for Copilot', 502)
}

async function assignCopilotToIssue(owner: string, repo: string, number: number, branch: string) {
  const response = await fetch(`/api/github/repos/${owner}/${repo}/issues/${number}/assignees`, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      assignees: ['copilot-swe-agent[bot]'],
      agent_assignment: {
        target_repo: `${owner}/${repo}`,
        base_branch: branch,
        custom_instructions: '',
        custom_agent: '',
        model: '',
      },
    }),
  })
  if (!response.ok) {
    await fetch(`/api/github/repos/${owner}/${repo}/issues/${number}/comments`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        body: '@copilot Implement this architecture-driven change. Honor the feature definition and user stories in the issue body.',
      }),
    })
  }
}