export type GitProviderId = 'github' | 'azure-devops'

export interface RepoSelection {
  provider: GitProviderId
  repo: string
  branch: string
  path: string
  azureProject?: string
  azureRepoId?: string
}

export function selectionToProperties(selection: RepoSelection): Record<string, string> {
  if (selection.provider === 'github') {
    return {
      gitProvider: 'github',
      gitRepo: selection.repo,
      gitBranch: selection.branch,
      gitPath: selection.path,
    }
  }
  return {
    gitProvider: 'azure-devops',
    gitRepo: selection.repo,
    gitBranch: selection.branch,
    gitPath: selection.path,
    gitAzureProject: selection.azureProject ?? '',
    gitAzureRepoId: selection.azureRepoId ?? '',
  }
}