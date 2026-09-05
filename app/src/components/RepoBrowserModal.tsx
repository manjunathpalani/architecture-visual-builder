import { useCallback, useEffect, useState } from 'react'
import {
  ChevronRight,
  FileJson,
  Folder,
  Code2,
  Cloud,
  Loader2,
  X,
} from 'lucide-react'
import { isAzureDevOpsConnected, isGitHubConnected } from '../utils/gitCredentials'
import { GitApiError } from '../utils/gitProviders/apiClient'
import {
  listAzureBranches,
  listAzureItems,
  listAzureProjects,
  listAzureRepos,
  readAzureFile,
} from '../utils/gitProviders/azureDevOpsApi'
import {
  listGitHubBranches,
  listGitHubContents,
  listGitHubRepos,
  readGitHubFile,
} from '../utils/gitProviders/githubApi'
import type { GitProviderId, RepoSelection } from '../utils/gitProviders/types'

type BrowserMode = 'link' | 'pull' | 'push'

interface RepoBrowserModalProps {
  mode: BrowserMode
  initialProvider?: GitProviderId
  onClose: () => void
  onSelectLink?: (selection: RepoSelection) => void
  onPullJson?: (content: string, selection: RepoSelection) => void
  onPushPath?: (selection: RepoSelection) => void
}

export function RepoBrowserModal({
  mode,
  initialProvider,
  onClose,
  onSelectLink,
  onPullJson,
  onPushPath,
}: RepoBrowserModalProps) {
  const [provider, setProvider] = useState<GitProviderId>(
    initialProvider ?? (isGitHubConnected() ? 'github' : 'azure-devops'),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [repos, setRepos] = useState<{ id: string; name: string; fullName: string; defaultBranch: string; project?: string }[]>([])
  const [selectedRepo, setSelectedRepo] = useState<typeof repos[0] | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState<{ name: string; path: string; isFolder: boolean }[]>([])

  const loadRepos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (provider === 'github') {
        const ghRepos = await listGitHubRepos()
        setRepos(
          ghRepos.map((r) => ({
            id: String(r.id),
            name: r.name,
            fullName: r.full_name,
            defaultBranch: r.default_branch,
          })),
        )
      } else {
        const projects = await listAzureProjects()
        const all: typeof repos = []
        for (const project of projects) {
          const azRepos = await listAzureRepos(project.name)
          azRepos.forEach((r) => {
            all.push({
              id: r.id,
              name: r.name,
              fullName: `${project.name}/${r.name}`,
              defaultBranch: r.defaultBranch?.replace('refs/heads/', '') ?? 'main',
              project: project.name,
            })
          })
        }
        setRepos(all)
      }
    } catch (err) {
      setError(err instanceof GitApiError ? err.message : 'Failed to load repositories')
    } finally {
      setLoading(false)
    }
  }, [provider])

  const loadBranches = useCallback(async (repo: typeof selectedRepo) => {
    if (!repo) return
    setLoading(true)
    setError(null)
    try {
      if (provider === 'github') {
        const [owner, name] = repo.fullName.split('/')
        const bs = await listGitHubBranches(owner, name)
        setBranches(bs.map((b) => b.name))
      } else {
        const bs = await listAzureBranches(repo.project!, repo.id)
        setBranches(bs.map((b) => b.name))
      }
      setSelectedBranch(repo.defaultBranch)
    } catch (err) {
      setError(err instanceof GitApiError ? err.message : 'Failed to load branches')
    } finally {
      setLoading(false)
    }
  }, [provider])

  const loadItems = useCallback(async (path: string) => {
    if (!selectedRepo || !selectedBranch) return
    setLoading(true)
    setError(null)
    try {
      if (provider === 'github') {
        const [owner, name] = selectedRepo.fullName.split('/')
        const contents = await listGitHubContents(owner, name, path, selectedBranch)
        setItems(
          contents
            .filter((c) => c.type === 'dir' || (mode === 'pull' && c.name.endsWith('.json')))
            .map((c) => ({
              name: c.name,
              path: c.path,
              isFolder: c.type === 'dir',
            })),
        )
      } else {
        const azItems = await listAzureItems(
          selectedRepo.project!,
          selectedRepo.id,
          path ? `/${path}` : '/',
          selectedBranch,
        )
        setItems(
          azItems
            .filter((i) => i.isFolder || (mode === 'pull' && i.path.endsWith('.json')))
            .map((i) => ({
              name: i.path.split('/').pop() ?? i.path,
              path: i.path.replace(/^\//, ''),
              isFolder: i.isFolder,
            })),
        )
      }
    } catch (err) {
      setError(err instanceof GitApiError ? err.message : 'Failed to load folder')
    } finally {
      setLoading(false)
    }
  }, [provider, selectedRepo, selectedBranch, mode])

  useEffect(() => {
    if (isGitHubConnected() || isAzureDevOpsConnected()) loadRepos()
  }, [loadRepos])

  useEffect(() => {
    if (selectedRepo) {
      loadBranches(selectedRepo)
      setCurrentPath('')
      setItems([])
    }
  }, [selectedRepo, loadBranches])

  useEffect(() => {
    if (selectedRepo && selectedBranch) loadItems(currentPath)
  }, [selectedBranch, selectedRepo, loadItems, currentPath])

  const buildSelection = (path: string): RepoSelection => ({
    provider,
    repo: provider === 'github' ? selectedRepo!.fullName : selectedRepo!.name,
    branch: selectedBranch,
    path,
    azureProject: selectedRepo?.project,
    azureRepoId: provider === 'azure-devops' ? selectedRepo?.id : undefined,
  })

  const handleSelectFolder = (path: string) => {
    const selection = buildSelection(path)
    if (mode === 'link') onSelectLink?.(selection)
    if (mode === 'push') onPushPath?.(selection)
    onClose()
  }

  const handlePullFile = async (path: string) => {
    if (!selectedRepo) return
    setLoading(true)
    setError(null)
    try {
      let content: string
      if (provider === 'github') {
        const [owner, name] = selectedRepo.fullName.split('/')
        content = await readGitHubFile(owner, name, path, selectedBranch)
      } else {
        content = await readAzureFile(
          selectedRepo.project!,
          selectedRepo.id,
          `/${path}`,
          selectedBranch,
        )
      }
      onPullJson?.(content, buildSelection(path))
      onClose()
    } catch (err) {
      setError(err instanceof GitApiError ? err.message : 'Failed to read file')
    } finally {
      setLoading(false)
    }
  }

  const pathParts = currentPath ? currentPath.split('/') : []

  return (
    <div className="repo-browser-overlay">
      <div className="repo-browser">
        <div className="repo-browser-header">
          <div>
            <h2>
              {mode === 'link' ? 'Browse Repository' : mode === 'pull' ? 'Pull from Repository' : 'Push to Repository'}
            </h2>
            <p>Select a repository, branch, and {mode === 'pull' ? 'JSON file' : 'folder'}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="repo-browser-providers">
          <button
            type="button"
            className={`provider-btn ${provider === 'github' ? 'active' : ''}`}
            disabled={!isGitHubConnected()}
            onClick={() => { setProvider('github'); setSelectedRepo(null) }}
          >
            <Code2 size={16} /> GitHub
          </button>
          <button
            type="button"
            className={`provider-btn ${provider === 'azure-devops' ? 'active' : ''}`}
            disabled={!isAzureDevOpsConnected()}
            onClick={() => { setProvider('azure-devops'); setSelectedRepo(null) }}
          >
            <Cloud size={16} /> Azure DevOps
          </button>
        </div>

        {!isGitHubConnected() && !isAzureDevOpsConnected() && (
          <p className="repo-browser-warn">Connect GitHub or Azure DevOps in Settings → Git first.</p>
        )}

        {error && <div className="json-error">{error}</div>}

        <div className="repo-browser-body">
          <div className="repo-browser-col">
            <h4>Repositories</h4>
            <div className="repo-browser-list">
              {loading && !repos.length ? <Loader2 size={20} className="spin" /> : null}
              {repos.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  className={`repo-list-item ${selectedRepo?.id === repo.id ? 'active' : ''}`}
                  onClick={() => setSelectedRepo(repo)}
                >
                  {repo.fullName}
                </button>
              ))}
            </div>
          </div>

          {selectedRepo && (
            <div className="repo-browser-col">
              <h4>Branch</h4>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              <h4>Path</h4>
              <div className="repo-breadcrumb">
                <button type="button" onClick={() => setCurrentPath('')}>root</button>
                {pathParts.map((part, i) => (
                  <span key={i}>
                    <ChevronRight size={12} />
                    <button
                      type="button"
                      onClick={() => setCurrentPath(pathParts.slice(0, i + 1).join('/'))}
                    >
                      {part}
                    </button>
                  </span>
                ))}
              </div>

              <div className="repo-browser-list">
                {loading ? <Loader2 size={20} className="spin" /> : null}
                {items.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    className="repo-list-item"
                    onClick={() => {
                      if (item.isFolder) {
                        setCurrentPath(item.path)
                      } else if (mode === 'pull') {
                        handlePullFile(item.path)
                      }
                    }}
                  >
                    {item.isFolder ? <Folder size={14} /> : <FileJson size={14} />}
                    {item.name}
                  </button>
                ))}
              </div>

              {mode !== 'pull' && (
                <button
                  type="button"
                  className="btn-primary repo-select-btn"
                  disabled={!selectedBranch}
                  onClick={() => handleSelectFolder(currentPath)}
                >
                  Select {currentPath || 'root'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}