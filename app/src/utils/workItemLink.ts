import type { ArchitectureDocument, Integration, SystemNode, SystemProperties } from '../types'

export type AlmProvider = 'jira' | 'azure-devops'

export interface WorkItemFields {
  jiraIssueKey?: string
  jiraIssueSummary?: string
  jiraIssueUrl?: string
  adoProject?: string
  adoWorkItemId?: string
  adoWorkItemTitle?: string
  adoWorkItemUrl?: string
}

export interface LinkedWorkItem {
  ownerId: string
  ownerLabel: string
  ownerKind: 'system' | 'integration'
  fields: WorkItemFields
}

export function hasJiraLink(fields?: WorkItemFields | null): boolean {
  if (!fields) return false
  return Boolean(fields.jiraIssueKey?.trim() || fields.jiraIssueUrl?.trim())
}

export function hasAdoLink(fields?: WorkItemFields | null): boolean {
  if (!fields) return false
  return Boolean(fields.adoWorkItemId?.trim() || fields.adoWorkItemUrl?.trim())
}

export function hasWorkItemLink(fields?: WorkItemFields | null): boolean {
  return hasJiraLink(fields) || hasAdoLink(fields)
}

export function buildJiraBrowseUrl(fields: WorkItemFields, site?: string | null): string | null {
  if (fields.jiraIssueUrl?.trim()) return fields.jiraIssueUrl.trim()
  const key = fields.jiraIssueKey?.trim()
  if (!key || !site) return null
  return `https://${site}.atlassian.net/browse/${encodeURIComponent(key)}`
}

export function buildAdoWorkItemUrl(
  fields: WorkItemFields,
  organization?: string | null,
): string | null {
  if (fields.adoWorkItemUrl?.trim()) return fields.adoWorkItemUrl.trim()
  const id = fields.adoWorkItemId?.trim()
  const project = fields.adoProject?.trim()
  if (!id || !project || !organization) return null
  return `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_workitems/edit/${encodeURIComponent(id)}`
}

export function getJiraLabel(fields: WorkItemFields): string {
  const key = fields.jiraIssueKey?.trim()
  if (!key) return fields.jiraIssueUrl?.trim() ? 'Jira issue' : ''
  const summary = fields.jiraIssueSummary?.trim()
  return summary ? `${key} · ${summary}` : key
}

export function getAdoLabel(fields: WorkItemFields): string {
  const id = fields.adoWorkItemId?.trim()
  if (!id) return fields.adoWorkItemUrl?.trim() ? 'Azure work item' : ''
  const title = fields.adoWorkItemTitle?.trim()
  return title ? `#${id} · ${title}` : `#${id}`
}

export function getWorkItemLabel(fields: WorkItemFields): string {
  const parts = [getJiraLabel(fields), getAdoLabel(fields)].filter(Boolean)
  return parts.join(' · ')
}

export function clearJiraFields(): WorkItemFields {
  return { jiraIssueKey: undefined, jiraIssueSummary: undefined, jiraIssueUrl: undefined }
}

export function clearAdoFields(): WorkItemFields {
  return {
    adoProject: undefined,
    adoWorkItemId: undefined,
    adoWorkItemTitle: undefined,
    adoWorkItemUrl: undefined,
  }
}

export function collectLinkedWorkItems(document: ArchitectureDocument): LinkedWorkItem[] {
  const items: LinkedWorkItem[] = []

  const walk = (systems: SystemNode[], integrations: Integration[]) => {
    for (const system of systems) {
      if (hasWorkItemLink(system.properties)) {
        items.push({
          ownerId: system.id,
          ownerLabel: system.label,
          ownerKind: 'system',
          fields: system.properties ?? {},
        })
      }
      if (system.subDiagram) {
        walk(system.subDiagram.systems, system.subDiagram.integrations)
      }
    }
    for (const integration of integrations) {
      const fields = workItemFieldsFromIntegration(integration)
      if (hasWorkItemLink(fields)) {
        items.push({
          ownerId: integration.id,
          ownerLabel: integration.label,
          ownerKind: 'integration',
          fields,
        })
      }
    }
  }

  walk(document.systems, document.integrations)
  return items
}

export function workItemFieldsFromProperties(properties?: SystemProperties): WorkItemFields {
  return pickWorkItemFields(properties)
}

export function workItemFieldsFromIntegration(integration: Integration): WorkItemFields {
  return pickWorkItemFields(integration)
}

function pickWorkItemFields(source?: {
  jiraIssueKey?: string
  jiraIssueSummary?: string
  jiraIssueUrl?: string
  adoProject?: string
  adoWorkItemId?: string
  adoWorkItemTitle?: string
  adoWorkItemUrl?: string
} | null): WorkItemFields {
  if (!source) return {}
  return {
    jiraIssueKey: source.jiraIssueKey,
    jiraIssueSummary: source.jiraIssueSummary,
    jiraIssueUrl: source.jiraIssueUrl,
    adoProject: source.adoProject,
    adoWorkItemId: source.adoWorkItemId,
    adoWorkItemTitle: source.adoWorkItemTitle,
    adoWorkItemUrl: source.adoWorkItemUrl,
  }
}
