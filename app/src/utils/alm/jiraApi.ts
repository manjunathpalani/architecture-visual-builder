import { GitApiError } from '../gitProviders/apiClient'
import { getJiraCredentials, normalizeJiraSite } from '../gitCredentials'

export interface JiraProject {
  id: string
  key: string
  name: string
}

export interface JiraIssue {
  id: string
  key: string
  summary: string
  status: string
  type: string
  url: string
}

function getSite(): string {
  const creds = getJiraCredentials()
  if (!creds?.site || !creds.email || !creds.token) {
    throw new GitApiError('Jira not connected', 401)
  }
  return normalizeJiraSite(creds.site)
}

function getHeaders(): Record<string, string> {
  const creds = getJiraCredentials()
  if (!creds?.email || !creds.token) throw new GitApiError('Jira not connected', 401)
  const encoded = btoa(`${creds.email}:${creds.token}`)
  return {
    Authorization: `Basic ${encoded}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

function jiraUrl(path: string): string {
  return `/api/jira/${getSite()}${path}`
}

async function jiraFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(jiraUrl(path), {
    ...init,
    headers: { ...getHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  })

  if (!response.ok) {
    let message = `Jira request failed (${response.status})`
    try {
      const body = (await response.json()) as {
        message?: string
        errorMessages?: string[]
        errors?: Record<string, string>
      }
      message =
        body.errorMessages?.[0] ??
        body.message ??
        (body.errors ? Object.values(body.errors)[0] : undefined) ??
        message
    } catch {
      /* keep default */
    }
    if (response.status === 401 || response.status === 403) {
      message = 'Jira authentication failed. Check the site, email, and API token.'
    }
    throw new GitApiError(message, response.status)
  }

  if (response.status === 204) return {} as T
  return response.json() as Promise<T>
}

export async function testJiraConnection(): Promise<{ displayName: string; site: string }> {
  const me = await jiraFetch<{ displayName?: string; emailAddress?: string }>('/rest/api/3/myself')
  return {
    displayName: me.displayName || me.emailAddress || 'Jira user',
    site: getSite(),
  }
}

export async function listJiraProjects(): Promise<JiraProject[]> {
  try {
    const result = await jiraFetch<{ values?: JiraProject[] }>(
      '/rest/api/3/project/search?maxResults=100&orderBy=name',
    )
    if (result.values) return result.values.map((p) => ({ id: p.id, key: p.key, name: `${p.name}` }))
  } catch (err) {
    if (err instanceof GitApiError && (err.status === 401 || err.status === 403)) throw err
  }

  const legacy = await jiraFetch<Array<{ id: string; key: string; name: string }>>('/rest/api/3/project')
  return legacy.map((p) => ({ id: p.id, key: p.key, name: p.name }))
}

export async function searchJiraIssues(query?: string, projectKey?: string): Promise<JiraIssue[]> {
  const clauses: string[] = []
  const trimmed = query?.trim() ?? ''
  if (projectKey) clauses.push(`project = "${escapeJql(projectKey)}"`)
  if (trimmed) {
    if (/^[A-Z][A-Z0-9_]+-\d+$/i.test(trimmed)) {
      clauses.push(`key = "${escapeJql(trimmed.toUpperCase())}"`)
    } else {
      clauses.push(`text ~ "${escapeJql(trimmed)}"`)
    }
  }
  const jql = `${clauses.join(' AND ')} ORDER BY updated DESC`.trim()
  const params = new URLSearchParams({
    jql,
    maxResults: '40',
    fields: 'summary,status,issuetype',
  })

  try {
    const result = await jiraFetch<{ issues?: JiraIssueRaw[] }>(`/rest/api/3/search/jql?${params}`)
    return (result.issues ?? []).map(mapIssue)
  } catch (err) {
    if (!(err instanceof GitApiError) || err.status === 401 || err.status === 403) throw err
    const result = await jiraFetch<{ issues?: JiraIssueRaw[] }>(`/rest/api/3/search?${params}`)
    return (result.issues ?? []).map(mapIssue)
  }
}

interface JiraIssueRaw {
  id: string
  key: string
  fields?: {
    summary?: string
    status?: { name?: string }
    issuetype?: { name?: string }
  }
}

function mapIssue(issue: JiraIssueRaw): JiraIssue {
  return {
    id: issue.id,
    key: issue.key,
    summary: issue.fields?.summary ?? '',
    status: issue.fields?.status?.name ?? '',
    type: issue.fields?.issuetype?.name ?? '',
    url: `https://${getSite()}.atlassian.net/browse/${issue.key}`,
  }
}

function escapeJql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
