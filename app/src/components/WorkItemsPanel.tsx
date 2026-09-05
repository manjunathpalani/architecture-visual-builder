import { ExternalLink, Ticket, X } from 'lucide-react'
import type { ArchitectureDocument } from '../types'
import { getAzureDevOpsCredentials, getJiraCredentials } from '../utils/gitCredentials'
import {
  buildAdoWorkItemUrl,
  buildJiraBrowseUrl,
  collectLinkedWorkItems,
  getWorkItemLabel,
  hasAdoLink,
  hasJiraLink,
} from '../utils/workItemLink'

interface WorkItemsPanelProps {
  document: ArchitectureDocument
  onClose: () => void
  onSelectSystem: (id: string) => void
}

export function WorkItemsPanel({ document, onClose, onSelectSystem }: WorkItemsPanelProps) {
  const linked = collectLinkedWorkItems(document)
  const jiraSite = getJiraCredentials()?.site
  const adoOrg = getAzureDevOpsCredentials()?.organization

  return (
    <div className="code-links-overlay">
      <div className="code-links-panel">
        <div className="code-links-panel-header">
          <div>
            <h2>
              <Ticket size={20} />
              Work item links
            </h2>
            <p>
              {linked.length} component{linked.length === 1 ? '' : 's'} linked to Jira or Azure DevOps
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {linked.length === 0 ? (
          <div className="code-links-empty">
            <p>No work items linked yet.</p>
            <p>
              Select a system or integration and add a Jira issue or Azure DevOps work item in Properties.
            </p>
          </div>
        ) : (
          <ul className="code-links-list">
            {linked.map((item) => {
              const url = hasJiraLink(item.fields)
                ? buildJiraBrowseUrl(item.fields, jiraSite)
                : hasAdoLink(item.fields)
                  ? buildAdoWorkItemUrl(item.fields, adoOrg)
                  : null
              const provider = hasJiraLink(item.fields) ? 'Jira' : 'Azure DevOps'
              return (
                <li key={`${item.ownerKind}-${item.ownerId}`} className="code-links-item">
                  <div className="code-links-item-info">
                    <strong>{item.ownerLabel}</strong>
                    <span className="code-links-meta">
                      {item.ownerKind === 'system' ? 'System' : 'Integration'} · {provider} ·{' '}
                      {getWorkItemLabel(item.fields)}
                    </span>
                  </div>
                  <div className="code-links-item-actions">
                    {item.ownerKind === 'system' && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => onSelectSystem(item.ownerId)}
                      >
                        Select
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!url}
                      onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
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
