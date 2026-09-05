export interface GitHubCredentials {
  token: string
  username?: string
}

export interface AzureDevOpsCredentials {
  organization: string
  token: string
}

export interface JiraCredentials {
  site: string
  email: string
  token: string
}

interface StoredCredentials {
  github?: GitHubCredentials
  azure?: AzureDevOpsCredentials
  jira?: JiraCredentials
}

const STORAGE_KEY = 'architecture-visual-builder-git'

function load(): StoredCredentials {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredCredentials) : {}
  } catch {
    return {}
  }
}

function save(data: StoredCredentials) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getGitHubCredentials(): GitHubCredentials | null {
  return load().github ?? null
}

export function setGitHubCredentials(creds: GitHubCredentials | null) {
  const data = load()
  if (creds) data.github = creds
  else delete data.github
  save(data)
}

export function getAzureDevOpsCredentials(): AzureDevOpsCredentials | null {
  return load().azure ?? null
}

export function setAzureDevOpsCredentials(creds: AzureDevOpsCredentials | null) {
  const data = load()
  if (creds) data.azure = creds
  else delete data.azure
  save(data)
}

export function isGitHubConnected(): boolean {
  return Boolean(getGitHubCredentials()?.token)
}

export function isAzureDevOpsConnected(): boolean {
  const azure = getAzureDevOpsCredentials()
  return Boolean(azure?.token && azure?.organization)
}

export function normalizeJiraSite(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.atlassian\.net$/i, '')
}

export function getJiraCredentials(): JiraCredentials | null {
  return load().jira ?? null
}

export function setJiraCredentials(creds: JiraCredentials | null) {
  const data = load()
  if (creds) {
    data.jira = {
      site: normalizeJiraSite(creds.site),
      email: creds.email.trim(),
      token: creds.token.trim(),
    }
  } else {
    delete data.jira
  }
  save(data)
}

export function isJiraConnected(): boolean {
  const jira = getJiraCredentials()
  return Boolean(jira?.token && jira?.email && jira?.site)
}