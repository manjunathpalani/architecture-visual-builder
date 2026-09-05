import { Ticket } from 'lucide-react'
import {
  getAzureDevOpsCredentials,
  getJiraCredentials,
} from '../utils/gitCredentials'
import {
  buildAdoWorkItemUrl,
  buildJiraBrowseUrl,
  getAdoLabel,
  getJiraLabel,
  hasAdoLink,
  hasJiraLink,
  type WorkItemFields,
} from '../utils/workItemLink'

interface WorkItemBadgeProps {
  fields?: WorkItemFields | null
  compact?: boolean
}

export function WorkItemBadge({ fields, compact }: WorkItemBadgeProps) {
  if (!fields || (!hasJiraLink(fields) && !hasAdoLink(fields))) return null

  const jiraSite = getJiraCredentials()?.site
  const adoOrg = getAzureDevOpsCredentials()?.organization
  const jiraUrl = hasJiraLink(fields) ? buildJiraBrowseUrl(fields, jiraSite) : null
  const adoUrl = hasAdoLink(fields) ? buildAdoWorkItemUrl(fields, adoOrg) : null
  const url = jiraUrl ?? adoUrl
  const label = hasJiraLink(fields)
    ? fields.jiraIssueKey?.trim() || getJiraLabel(fields)
    : fields.adoWorkItemId
      ? `#${fields.adoWorkItemId}`
      : getAdoLabel(fields)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      className={`work-item-badge ${compact ? 'compact' : ''} ${hasJiraLink(fields) ? 'jira' : 'ado'}`}
      title={url ? `Open work item: ${url}` : label}
      onClick={handleClick}
    >
      <Ticket size={compact ? 10 : 12} />
      <span>{label}</span>
    </button>
  )
}
