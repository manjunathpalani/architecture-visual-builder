import type { SystemNode, SystemProperties } from '../types'

export type GitProvider = 'github' | 'gitlab' | 'azure-devops' | 'bitbucket' | 'local' | 'other'

export const GIT_PROVIDERS: { id: GitProvider; label: string }[] = [
  { id: 'github', label: 'GitHub' },
  { id: 'gitlab', label: 'GitLab' },
  { id: 'azure-devops', label: 'Azure DevOps' },
  { id: 'bitbucket', label: 'Bitbucket' },
  { id: 'local', label: 'Local / Other' },
  { id: 'other', label: 'Custom URL' },
]

export interface ParsedRepo {
  provider: GitProvider
  owner: string
  repo: string
  host?: string
}

export function hasCodeLink(properties?: SystemProperties): boolean {
  if (!properties) return false
  return Boolean(properties.gitRepo?.trim() || properties.gitUrl?.trim())
}

export function parseGitRepo(input: string, provider?: GitProvider): ParsedRepo | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const sshMatch = trimmed.match(/git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/)
  if (sshMatch) {
    const host = sshMatch[1]
    return {
      provider: detectProviderFromHost(host, provider),
      owner: sshMatch[2],
      repo: sshMatch[3].replace(/\.git$/, ''),
      host,
    }
  }

  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed)
      const host = url.hostname
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) {
        const detected = detectProviderFromHost(host, provider)
        if (detected === 'azure-devops') {
          return {
            provider: detected,
            owner: parts[0],
            repo: parts[parts.length - 1].replace(/\.git$/, ''),
            host,
          }
        }
        return {
          provider: detected,
          owner: parts[0],
          repo: parts[1].replace(/\.git$/, ''),
          host,
        }
      }
    }
  } catch {
    // fall through to owner/repo format
  }

  const slashMatch = trimmed.match(/^([^/]+)\/([^/]+)$/)
  if (slashMatch) {
    return {
      provider: provider ?? 'github',
      owner: slashMatch[1],
      repo: slashMatch[2].replace(/\.git$/, ''),
    }
  }

  return null
}

function detectProviderFromHost(host: string, fallback?: GitProvider): GitProvider {
  if (host.includes('github')) return 'github'
  if (host.includes('gitlab')) return 'gitlab'
  if (host.includes('dev.azure.com') || host.includes('visualstudio.com')) return 'azure-devops'
  if (host.includes('bitbucket')) return 'bitbucket'
  return fallback ?? 'other'
}

export function buildBrowseUrl(properties: SystemProperties): string | null {
  if (properties.gitUrl?.trim()) return properties.gitUrl.trim()

  const repo = properties.gitRepo?.trim()
  if (!repo) return null

  const parsed = parseGitRepo(repo, properties.gitProvider as GitProvider | undefined)
  if (!parsed) return null

  const branch = properties.gitBranch?.trim() || 'main'
  const path = properties.gitPath?.trim().replace(/^\//, '') ?? ''
  const commit = properties.gitCommit?.trim()

  switch (parsed.provider) {
    case 'github': {
      const base = parsed.host
        ? `https://${parsed.host}/${parsed.owner}/${parsed.repo}`
        : `https://github.com/${parsed.owner}/${parsed.repo}`
      if (commit) return `${base}/tree/${commit}${path ? `/${path}` : ''}`
      return `${base}/tree/${branch}${path ? `/${path}` : ''}`
    }
    case 'gitlab': {
      const base = parsed.host
        ? `https://${parsed.host}/${parsed.owner}/${parsed.repo}`
        : `https://gitlab.com/${parsed.owner}/${parsed.repo}`
      if (commit) return `${base}/-/tree/${commit}${path ? `/${path}` : ''}`
      return `${base}/-/tree/${branch}${path ? `/${path}` : ''}`
    }
    case 'azure-devops': {
      const org = parsed.owner
      const repoName = parsed.repo
      const pathParam = path ? `&path=/${encodeURIComponent(path)}` : ''
      const version = commit ? `GC${commit}` : `GB${branch}`
      return `https://dev.azure.com/${org}/_git/${repoName}?version=${version}${pathParam}`
    }
    case 'bitbucket': {
      const base = `https://bitbucket.org/${parsed.owner}/${parsed.repo}`
      if (commit) return `${base}/src/${commit}/${path}`
      return `${base}/src/${branch}/${path}`
    }
    default:
      return repo.startsWith('http') ? repo : null
  }
}

export function getCodeLinkLabel(properties: SystemProperties): string {
  const repo = properties.gitRepo?.trim()
  const path = properties.gitPath?.trim()
  const branch = properties.gitBranch?.trim()

  if (repo && path) return `${shortRepo(repo)}/${path}`
  if (repo && branch) return `${shortRepo(repo)}@${branch}`
  if (repo) return shortRepo(repo)
  if (properties.gitUrl) return 'Custom link'
  return ''
}

function shortRepo(repo: string): string {
  const parsed = parseGitRepo(repo)
  if (parsed) return `${parsed.owner}/${parsed.repo}`
  return repo.length > 28 ? `${repo.slice(0, 25)}…` : repo
}

export function openCodeLink(properties: SystemProperties): boolean {
  const url = buildBrowseUrl(properties)
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

export function getLinkedSystems(systems: SystemNode[]): SystemNode[] {
  return systems.filter((s) => hasCodeLink(s.properties))
}

export function autoDetectProvider(repo: string): GitProvider {
  const parsed = parseGitRepo(repo)
  return parsed?.provider ?? 'github'
}