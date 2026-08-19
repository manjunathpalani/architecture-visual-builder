import { ExternalLink, FolderGit2, Search } from 'lucide-react'
import { useState } from 'react'
import type { SystemProperties } from '../types'
import {
  GIT_PROVIDERS,
  autoDetectProvider,
  buildBrowseUrl,
  hasCodeLink,
  openCodeLink,
} from '../utils/codeLink'
import { isAzureDevOpsConnected, isGitHubConnected } from '../utils/gitCredentials'
import { RepoBrowserModal } from './RepoBrowserModal'
import { selectionToProperties } from '../utils/gitProviders/types'

interface CodeLinkSectionProps {
  properties: SystemProperties
  onChange: (properties: Partial<SystemProperties>) => void
}

export function CodeLinkSection({ properties, onChange }: CodeLinkSectionProps) {
  const [showBrowser, setShowBrowser] = useState(false)
  const canBrowse = isGitHubConnected() || isAzureDevOpsConnected()

  const update = (patch: Partial<SystemProperties>) =>
    onChange({ ...properties, ...patch })

  const handleRepoChange = (value: string) => {
    const patch: Partial<SystemProperties> = { gitRepo: value }
    if (value && !properties.gitProvider) {
      patch.gitProvider = autoDetectProvider(value)
    }
    update(patch)
  }

  const browseUrl = buildBrowseUrl(properties)
  const linked = hasCodeLink(properties)

  return (
    <div className="code-link-section">
      <div className="code-link-header">
        <FolderGit2 size={16} />
        <span>Codebase Link</span>
      </div>
      <p className="code-link-hint">
        Link this component to a Git repository, branch, and folder path.
      </p>

      <label>
        Git Provider
        <select
          value={properties.gitProvider ?? 'github'}
          onChange={(e) => update({ gitProvider: e.target.value })}
        >
          {GIT_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Repository
        <div className="input-with-btn">
          <input
            placeholder="org/repo or https://github.com/org/repo"
            value={properties.gitRepo ?? ''}
            onChange={(e) => handleRepoChange(e.target.value)}
          />
          {canBrowse && (
            <button
              type="button"
              className="btn-secondary browse-btn"
              title="Browse connected repositories"
              onClick={() => setShowBrowser(true)}
            >
              <Search size={14} />
              Browse
            </button>
          )}
        </div>
      </label>

      <label>
        Branch
        <input
          placeholder="main"
          value={properties.gitBranch ?? ''}
          onChange={(e) => update({ gitBranch: e.target.value })}
        />
      </label>

      <label>
        Path in repo
        <input
          placeholder="src/integrations/salesforce"
          value={properties.gitPath ?? ''}
          onChange={(e) => update({ gitPath: e.target.value })}
        />
      </label>

      <label>
        Commit / Tag (optional)
        <input
          placeholder="abc1234 or v1.2.0"
          value={properties.gitCommit ?? ''}
          onChange={(e) => update({ gitCommit: e.target.value })}
        />
      </label>

      <label>
        Direct URL (overrides generated link)
        <input
          placeholder="https://github.com/org/repo/tree/main/src"
          value={properties.gitUrl ?? ''}
          onChange={(e) => update({ gitUrl: e.target.value })}
        />
      </label>

      {linked && (
        <div className="code-link-actions">
          <button
            type="button"
            className="btn-secondary code-open-btn"
            disabled={!browseUrl}
            onClick={() => openCodeLink(properties)}
          >
            <ExternalLink size={14} />
            Open in Git
          </button>
          <button
            type="button"
            className="btn-reset-color"
            onClick={() =>
              onChange({
                ...properties,
                gitProvider: undefined,
                gitRepo: undefined,
                gitBranch: undefined,
                gitPath: undefined,
                gitCommit: undefined,
                gitUrl: undefined,
              })
            }
          >
            Clear link
          </button>
        </div>
      )}

      {browseUrl && (
        <div className="code-link-preview">
          <span className="code-link-preview-label">Opens:</span>
          <a href={browseUrl} target="_blank" rel="noopener noreferrer">
            {browseUrl}
          </a>
        </div>
      )}

      {showBrowser && (
        <RepoBrowserModal
          mode="link"
          initialProvider={
            properties.gitProvider === 'azure-devops' ? 'azure-devops' : 'github'
          }
          onClose={() => setShowBrowser(false)}
          onSelectLink={(selection) => {
            onChange({ ...properties, ...selectionToProperties(selection) })
            setShowBrowser(false)
          }}
        />
      )}
    </div>
  )
}