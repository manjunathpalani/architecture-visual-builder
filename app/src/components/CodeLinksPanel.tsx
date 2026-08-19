import { ExternalLink, FolderGit2, X } from 'lucide-react'
import type { SystemNode } from '../types'
import { buildBrowseUrl, getCodeLinkLabel, getLinkedSystems, openCodeLink } from '../utils/codeLink'

interface CodeLinksPanelProps {
  systems: SystemNode[]
  onClose: () => void
  onSelectSystem: (id: string) => void
}

export function CodeLinksPanel({ systems, onClose, onSelectSystem }: CodeLinksPanelProps) {
  const linked = getLinkedSystems(systems)

  return (
    <div className="code-links-overlay">
      <div className="code-links-panel">
        <div className="code-links-panel-header">
          <div>
            <h2>
              <FolderGit2 size={20} />
              Codebase Links
            </h2>
            <p>
              {linked.length} of {systems.length} components linked to Git repositories
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {linked.length === 0 ? (
          <div className="code-links-empty">
            <p>No components linked yet.</p>
            <p>Select any component and add a repository link in the Properties panel under <strong>Codebase Link</strong>.</p>
          </div>
        ) : (
          <ul className="code-links-list">
            {linked.map((system) => {
              const url = buildBrowseUrl(system.properties ?? {})
              const label = getCodeLinkLabel(system.properties ?? {})
              return (
                <li key={system.id} className="code-links-item">
                  <div className="code-links-item-info">
                    <strong>{system.label}</strong>
                    <span className="code-links-meta">
                      {system.category} · {label}
                    </span>
                    {system.properties?.gitBranch && (
                      <span className="code-links-branch">branch: {system.properties.gitBranch}</span>
                    )}
                  </div>
                  <div className="code-links-item-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => onSelectSystem(system.id)}
                    >
                      Select
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!url}
                      onClick={() => openCodeLink(system.properties ?? {})}
                    >
                      <ExternalLink size={14} />
                      Open
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}