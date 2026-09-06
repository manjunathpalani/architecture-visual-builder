import { SaasApiError, mapPool, normalizeInstanceUrl, odataErrorMessage, proxyUrl } from './instanceUrl'
import type { SaasCatalog, SaasEntity, SaasRelationship } from './types'

const API = '/services/data/v61.0'

interface SObjectRow {
  name?: string
  label?: string
  labelPlural?: string
  custom?: boolean
  queryable?: boolean
  deprecatedAndHidden?: boolean
  keyPrefix?: string
}

interface DescribeField {
  name?: string
  label?: string
  type?: string
  referenceTo?: string[]
  relationshipName?: string
}

interface DescribeResult {
  name?: string
  fields?: DescribeField[]
}

async function salesforceFetch<T>(instanceUrl: string, path: string, token: string): Promise<T> {
  const response = await fetch(proxyUrl('salesforce', instanceUrl, path), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  const payload = (await response.json().catch(() => ({}))) as T
  if (!response.ok) {
    throw new SaasApiError(
      odataErrorMessage(payload, `Salesforce request failed (${response.status})`),
      response.status,
    )
  }
  return payload
}

export async function fetchSalesforceCatalog(instanceUrlRaw: string, token: string): Promise<SaasCatalog> {
  const instanceUrl = normalizeInstanceUrl(instanceUrlRaw, 'salesforce')
  const result = await salesforceFetch<{ sobjects?: SObjectRow[] }>(instanceUrl, `${API}/sobjects`, token)
  const entities: SaasEntity[] = (result.sobjects ?? [])
    .filter((row) => row.name && row.queryable && !row.deprecatedAndHidden)
    .map((row) => ({
      key: row.name as string,
      logicalName: row.name as string,
      schemaName: row.name,
      label: row.label || (row.name as string),
      collectionLabel: row.labelPlural,
      isCustom: Boolean(row.custom),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return {
    provider: 'salesforce',
    providerLabel: 'Salesforce',
    instanceUrl,
    entities,
  }
}

export async function fetchSalesforceRelationships(
  instanceUrl: string,
  token: string,
  objectNames: string[],
): Promise<SaasRelationship[]> {
  const selected = new Set(objectNames)
  const describes = await mapPool(objectNames.slice(0, 40), 4, async (name) => {
    try {
      return await salesforceFetch<DescribeResult>(
        instanceUrl,
        `${API}/sobjects/${encodeURIComponent(name)}/describe`,
        token,
      )
    } catch {
      return { name, fields: [] } as DescribeResult
    }
  })

  const relationships: SaasRelationship[] = []
  const seen = new Set<string>()
  for (const describe of describes) {
    const from = describe.name
    if (!from) continue
    for (const field of describe.fields ?? []) {
      if (field.type !== 'reference' || !field.referenceTo?.length) continue
      for (const to of field.referenceTo) {
        if (!selected.has(to) || from === to) continue
        const id = `${from}.${field.name}->${to}`
        if (seen.has(id)) continue
        seen.add(id)
        relationships.push({
          id,
          schemaName: field.relationshipName || field.name || id,
          label: field.label || field.name || `${from} → ${to}`,
          from,
          to,
          fromAttribute: field.name,
        })
      }
    }
  }
  return relationships.slice(0, 120)
}
