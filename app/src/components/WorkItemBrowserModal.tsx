import { useCallback, useEffect, useState } from 'react'
import { Cloud, Loader2, Search, Ticket, X } from 'lucide-react'
import { isAzureDevOpsConnected, isJiraConnected } from '../utils/gitCredentials'
import { GitApiError } from '../utils/gitProviders/apiClient'
import { listAzureProjects, searchAzureWorkItems, type AzureWorkItem } from '../utils/gitProviders/azureDevOpsApi'
import { listJiraProjects, searchJiraIssues, type JiraIssue } from '../utils/alm/jiraApi'
import type { AlmProvider, WorkItemFields } from '../utils/workItemLink'

interface WorkItemBrowserModalProps {
  initialProvider?: AlmProvider
  onClose: () => void
  onSelect: (fields: WorkItemFields) => void
}

export function WorkItemBrowserModal({ initialProvider, onClose, onSelect }: WorkItemBrowserModalProps) {
  const [provider, setProvider] = useState<AlmProvider>(
    initialProvider ?? (isJiraConnected() ? 'jira' : 'azure-devops'),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<{ id: string; key: string; name: string }[]>([])
  const [project, setProject] = useState('')
  const [query, setQuery] = useState('')
  const [jiraIssues, setJiraIssues] = useState<JiraIssue[]>([])
  const [adoItems, setAdoItems] = useState<AzureWorkItem[]>([])

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProject('')
    setJiraIssues([])
    setAdoItems([])
    try {
      if (provider === 'jira') {
        const list = await listJiraProjects()
        setProjects(list.map((p) => ({ id: p.id, key: p.key, name: `${p.key} — ${p.name}` })))
        setProject(list[0]?.key ?? '')
      } else {
        const list = await listAzureProjects()
        setProjects(list.map((p) => ({ id: p.id, key: p.name, name: p.name })))
        setProject(list[0]?.name ?? '')
      }
    } catch (err) {
      setProjects([])
      setProject('')
      setError(err instanceof GitApiError ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [provider])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const runSearch = async () => {
    if (!project && provider === 'azure-devops') return
    setLoading(true)
    setError(null)
    try {
      if (provider === 'jira') {
        setJiraIssues(await searchJiraIssues(query, project || undefined))
      } else {
        setAdoItems(await searchAzureWorkItems(project, query))
      }
    } catch (err) {
      setError(err instanceof GitApiError ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!project || projects.length === 0) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        if (provider === 'jira') {
          const issues = await searchJiraIssues(query, project || undefined)
          if (!cancelled) setJiraIssues(issues)
        } else {
          const items = await searchAzureWorkItems(project, query)
          if (!cancelled) setAdoItems(items)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof GitApiError ? err.message : 'Search failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [project, provider, projects.length])

  return (
    <div className="repo-browser-overlay" onClick={(event) => event.stopPropagation()}>
      <div className="repo-browser work-item-browser">
        <div className="repo-browser-header">
          <div>
            <h2>Link work item</h2>
            <p>Search Jira issues or Azure DevOps work items and attach them to this component.</p>
          </div>
          <div className="dialog-header-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Back
            </button>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="repo-browser-providers">
          <button
            type="button"
            className={`provider-btn ${provider === 'jira' ? 'active' : ''}`}
            disabled={!isJiraConnected()}
            onClick={() => {
              setProvider('jira')
              setQuery('')
              setProject('')
              setProjects([])
              setJiraIssues([])
              setAdoItems([])
            }}
          >
            <Ticket size={16} /> Jira
          </button>
          <button
            type="button"
            className={`provider-btn ${provider === 'azure-devops' ? 'active' : ''}`}
            disabled={!isAzureDevOpsConnected()}
            onClick={() => {
              setProvider('azure-devops')
              setQuery('')
              setProject('')
              setProjects([])
              setJiraIssues([])
              setAdoItems([])
            }}
          >
            <Cloud size={16} /> Azure DevOps
          </button>
        </div>

        {!isJiraConnected() && !isAzureDevOpsConnected() && (
          <p className="repo-browser-warn">Connect Jira or Azure DevOps in Settings first.</p>
        )}

        <div className="work-item-toolbar">
          <label>
            Project
            <select value={project} onChange={(e) => setProject(e.target.value)} disabled={loading || projects.length === 0}>
              {projects.length === 0 && <option value="">No projects</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="work-item-search">
            Search
            <div className="input-with-btn">
              <input
                placeholder={provider === 'jira' ? 'Key or text (ABC-123)' : 'ID or title'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runSearch()
                }}
              />
              <button type="button" className="btn-secondary browse-btn" onClick={() => void runSearch()} disabled={loading}>
                {loading ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
                Search
              </button>
            </div>
          </label>
        </div>

        {error && <p className="git-status err">{error}</p>}

        <div className="work-item-results">
          {provider === 'jira' &&
            jiraIssues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                className="work-item-result"
                onClick={() =>
                  onSelect({
                    jiraIssueKey: issue.key,
                    jiraIssueSummary: issue.summary,
                    jiraIssueUrl: issue.url,
                  })
                }
              >
                <strong>{issue.key}</strong>
                <span>{issue.summary}</span>
                <em>
                  {issue.type}
                  {issue.status ? ` · ${issue.status}` : ''}
                </em>
              </button>
            ))}
          {provider === 'azure-devops' &&
            adoItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="work-item-result"
                onClick={() =>
                  onSelect({
                    adoProject: item.project,
                    adoWorkItemId: String(item.id),
                    adoWorkItemTitle: item.title,
                    adoWorkItemUrl: item.url,
                  })
                }
              >
                <strong>#{item.id}</strong>
                <span>{item.title}</span>
                <em>
                  {item.type}
                  {item.state ? ` · ${item.state}` : ''}
                </em>
              </button>
            ))}
          {!loading && provider === 'jira' && jiraIssues.length === 0 && !error && (
            <p className="work-item-empty">No Jira issues found.</p>
          )}
          {!loading && provider === 'azure-devops' && adoItems.length === 0 && !error && (
            <p className="work-item-empty">No Azure DevOps work items found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
