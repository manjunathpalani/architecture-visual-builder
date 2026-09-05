import { ExternalLink, Search, Ticket } from 'lucide-react'
import { useState } from 'react'
import {
  getAzureDevOpsCredentials,
  getJiraCredentials,
  isAzureDevOpsConnected,
  isJiraConnected,
} from '../utils/gitCredentials'
import {
  buildAdoWorkItemUrl,
  buildJiraBrowseUrl,
  clearAdoFields,
  clearJiraFields,
  getAdoLabel,
  getJiraLabel,
  hasAdoLink,
  hasJiraLink,
  type AlmProvider,
  type WorkItemFields,
} from '../utils/workItemLink'
import { WorkItemBrowserModal } from './WorkItemBrowserModal'

interface WorkItemLinkSectionProps {
  fields: WorkItemFields
  onChange: (fields: WorkItemFields) => void
}

export function WorkItemLinkSection({ fields, onChange }: WorkItemLinkSectionProps) {
  const [browser, setBrowser] = useState<AlmProvider | null>(null)
  const canBrowse = isJiraConnected() || isAzureDevOpsConnected()
  const jiraSite = getJiraCredentials()?.site
  const adoOrg = getAzureDevOpsCredentials()?.organization
  const jiraUrl = buildJiraBrowseUrl(fields, jiraSite)
  const adoUrl = buildAdoWorkItemUrl(fields, adoOrg)

  const update = (patch: WorkItemFields) => onChange({ ...fields, ...patch })

  return (
    <div className="code-link-section work-item-section">
      <div className="code-link-header">
        <Ticket size={16} />
        <span>Jira / Azure DevOps</span>
      </div>
      <p className="code-link-hint">
        Link this component to a Jira issue or Azure DevOps work item. Connect accounts under Settings to browse.
      </p>

      <label>
        Jira issue key
        <div className="input-with-btn">
          <input
            placeholder="PROJ-123"
            value={fields.jiraIssueKey ?? ''}
            onChange={(e) => update({ jiraIssueKey: e.target.value })}
          />
          {isJiraConnected() && (
            <button
              type="button"
              className="btn-secondary browse-btn"
              title="Browse Jira issues"
              onClick={() => setBrowser('jira')}
            >
              <Search size={14} />
              Browse
            </button>
          )}
        </div>
      </label>
      <label>
        Jira summary
        <input
          placeholder="Optional title"
          value={fields.jiraIssueSummary ?? ''}
          onChange={(e) => update({ jiraIssueSummary: e.target.value })}
        />
      </label>
      <label>
        Jira URL (optional)
        <input
          placeholder="https://your-site.atlassian.net/browse/PROJ-123"
          value={fields.jiraIssueUrl ?? ''}
          onChange={(e) => update({ jiraIssueUrl: e.target.value })}
        />
      </label>
      {hasJiraLink(fields) && (
        <div className="code-link-actions">
          <button
            type="button"
            className="btn-secondary code-open-btn"
            disabled={!jiraUrl}
            onClick={() => jiraUrl && window.open(jiraUrl, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink size={14} />
            Open in Jira
          </button>
          <button type="button" className="btn-reset-color" onClick={() => onChange({ ...fields, ...clearJiraFields() })}>
            Clear Jira
          </button>
        </div>
      )}
      {jiraUrl && (
        <div className="code-link-preview">
          <span className="code-link-preview-label">Jira:</span>
          <a href={jiraUrl} target="_blank" rel="noopener noreferrer">
            {getJiraLabel(fields) || jiraUrl}
          </a>
        </div>
      )}

      <label>
        Azure DevOps work item ID
        <div className="input-with-btn">
          <input
            placeholder="12345"
            value={fields.adoWorkItemId ?? ''}
            onChange={(e) => update({ adoWorkItemId: e.target.value })}
          />
          {isAzureDevOpsConnected() && (
            <button
              type="button"
              className="btn-secondary browse-btn"
              title="Browse Azure DevOps work items"
              onClick={() => setBrowser('azure-devops')}
            >
              <Search size={14} />
              Browse
            </button>
          )}
        </div>
      </label>
      <label>
        Azure DevOps project
        <input
          placeholder="Project name"
          value={fields.adoProject ?? ''}
          onChange={(e) => update({ adoProject: e.target.value })}
        />
      </label>
      <label>
        Work item title
        <input
          placeholder="Optional title"
          value={fields.adoWorkItemTitle ?? ''}
          onChange={(e) => update({ adoWorkItemTitle: e.target.value })}
        />
      </label>
      <label>
        Azure DevOps URL (optional)
        <input
          placeholder="https://dev.azure.com/org/project/_workitems/edit/123"
          value={fields.adoWorkItemUrl ?? ''}
          onChange={(e) => update({ adoWorkItemUrl: e.target.value })}
        />
      </label>
      {hasAdoLink(fields) && (
        <div className="code-link-actions">
          <button
            type="button"
            className="btn-secondary code-open-btn"
            disabled={!adoUrl}
            onClick={() => adoUrl && window.open(adoUrl, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink size={14} />
            Open in Azure DevOps
          </button>
          <button type="button" className="btn-reset-color" onClick={() => onChange({ ...fields, ...clearAdoFields() })}>
            Clear Azure DevOps
          </button>
        </div>
      )}
      {adoUrl && (
        <div className="code-link-preview">
          <span className="code-link-preview-label">Azure DevOps:</span>
          <a href={adoUrl} target="_blank" rel="noopener noreferrer">
            {getAdoLabel(fields) || adoUrl}
          </a>
        </div>
      )}

      {canBrowse && !hasJiraLink(fields) && !hasAdoLink(fields) && (
        <p className="code-link-hint">Use Browse to pick an issue from a connected Jira site or Azure DevOps project.</p>
      )}

      {browser && (
        <WorkItemBrowserModal
          initialProvider={browser}
          onClose={() => setBrowser(null)}
          onSelect={(selected) => {
            onChange({ ...fields, ...selected })
            setBrowser(null)
          }}
        />
      )}
    </div>
  )
}
