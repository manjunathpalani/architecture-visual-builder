import { getSaasConnection, setSaasConnection, saasTokenValid } from './credentials'
import {
  SaasApiError,
  mapPool,
  normalizeInstanceUrl,
  odataErrorMessage,
  proxyUrl,
} from './instanceUrl'
import type { SaasCatalog, SaasEntity, SaasRelationship } from './types'

const API = '/api/data/v9.2'
const CORE_TABLES = new Set([
  'account',
  'contact',
  'lead',
  'opportunity',
  'incident',
  'systemuser',
  'businessunit',
  'team',
  'quote',
  'salesorder',
  'invoice',
  'product',
  'email',
  'appointment',
  'phonecall',
])

interface LocalizedLabel {
  UserLocalizedLabel?: { Label?: string }
  LocalizedLabels?: Array<{ Label?: string }>
}

interface EntityDefinition {
  LogicalName?: string
  SchemaName?: string
  PrimaryNameAttribute?: string
  IsCustomEntity?: boolean
  IsActivity?: boolean
  IsIntersect?: boolean
  IsValidForAdvancedFind?: boolean
  DisplayName?: LocalizedLabel
  DisplayCollectionName?: LocalizedLabel
  Description?: LocalizedLabel
}

interface RelationshipRow {
  SchemaName?: string
  ReferencedEntity?: string
  ReferencingEntity?: string
  ReferencedAttribute?: string
  ReferencingAttribute?: string
}

interface WhoAmI {
  UserId?: string
  BusinessUnitId?: string
  OrganizationId?: string
}

function labelOf(value: LocalizedLabel | undefined, fallback: string): string {
  return value?.UserLocalizedLabel?.Label?.trim() || value?.LocalizedLabels?.[0]?.Label?.trim() || fallback
}

async function dynamicsFetch<T>(instanceUrl: string, path: string, token: string): Promise<T> {
  const response = await fetch(proxyUrl('dynamics', instanceUrl, path), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
  })
  const payload = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!response.ok) {
    throw new SaasApiError(
      odataErrorMessage(payload, `Dynamics request failed (${response.status})`),
      response.status,
    )
  }
  return payload
}

export async function resolveDynamicsToken(instanceUrl: string, pasted?: string): Promise<string> {
  if (pasted?.trim()) return pasted.trim()
  const stored = getSaasConnection('dynamics')
  if (stored && stored.instanceUrl === instanceUrl && saasTokenValid(stored)) return stored.accessToken
  if (stored?.refreshToken && stored.clientId && stored.instanceUrl === instanceUrl) {
    const { refreshDynamicsAccess } = await import('../cloud/oauth')
    return refreshDynamicsAccess()
  }
  throw new SaasApiError('Sign in to Dynamics 365 or paste an access token')
}

export async function fetchDynamicsCatalog(instanceUrlRaw: string, token: string): Promise<SaasCatalog> {
  const instanceUrl = normalizeInstanceUrl(instanceUrlRaw, 'dynamics')
  const who = await dynamicsFetch<WhoAmI>(instanceUrl, `${API}/WhoAmI`, token)
  let organizationName: string | undefined
  try {
    const orgs = await dynamicsFetch<{ value?: Array<{ name?: string }> }>(
      instanceUrl,
      `${API}/organizations?$select=name`,
      token,
    )
    organizationName = orgs.value?.[0]?.name
  } catch {
    organizationName = undefined
  }

  const select =
    'LogicalName,SchemaName,PrimaryNameAttribute,IsCustomEntity,IsActivity,IsIntersect,IsValidForAdvancedFind,DisplayName,DisplayCollectionName,Description'
  let path = `${API}/EntityDefinitions?$select=${select}&$filter=IsIntersect eq false`
  const entities: SaasEntity[] = []

  while (path && entities.length < 1200) {
    const page = await dynamicsFetch<{ value?: EntityDefinition[]; '@odata.nextLink'?: string }>(
      instanceUrl,
      path,
      token,
    )
    for (const row of page.value ?? []) {
      const logicalName = row.LogicalName?.trim()
      if (!logicalName) continue
      entities.push({
        key: logicalName,
        logicalName,
        schemaName: row.SchemaName,
        label: labelOf(row.DisplayName, row.SchemaName || logicalName),
        collectionLabel: labelOf(row.DisplayCollectionName, ''),
        description: labelOf(row.Description, ''),
        isCustom: Boolean(row.IsCustomEntity),
        isActivity: Boolean(row.IsActivity),
        primaryName: row.PrimaryNameAttribute,
      })
    }
    path = page['@odata.nextLink'] ?? ''
  }

  entities.sort((a, b) => a.label.localeCompare(b.label))

  const stored = getSaasConnection('dynamics')
  if (stored && stored.instanceUrl === instanceUrl) {
    setSaasConnection('dynamics', { ...stored, organizationName })
  }

  return {
    provider: 'dynamics',
    providerLabel: 'Dynamics 365 / Dataverse',
    instanceUrl,
    organizationName: organizationName || who.OrganizationId,
    entities,
  }
}

export function isCoreDynamicsTable(logicalName: string): boolean {
  return CORE_TABLES.has(logicalName.toLowerCase())
}

export async function fetchDynamicsRelationships(
  instanceUrl: string,
  token: string,
  logicalNames: string[],
): Promise<SaasRelationship[]> {
  const selected = new Set(logicalNames)
  const pages = await mapPool(logicalNames.slice(0, 60), 5, async (name) => {
    try {
      const result = await dynamicsFetch<{ value?: RelationshipRow[] }>(
        instanceUrl,
        `${API}/EntityDefinitions(LogicalName='${encodeURIComponent(name)}')/ManyToOneRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencedAttribute,ReferencingAttribute`,
        token,
      )
      return result.value ?? []
    } catch {
      return [] as RelationshipRow[]
    }
  })

  const relationships: SaasRelationship[] = []
  const seen = new Set<string>()
  for (const rows of pages) {
    for (const row of rows) {
      const from = row.ReferencingEntity
      const to = row.ReferencedEntity
      if (!from || !to || from === to) continue
      if (!selected.has(from) || !selected.has(to)) continue
      const id = row.SchemaName || `${from}->${to}`
      if (seen.has(id)) continue
      seen.add(id)
      relationships.push({
        id,
        schemaName: row.SchemaName || id,
        label: row.ReferencingAttribute || row.SchemaName || `${from} → ${to}`,
        from,
        to,
        fromAttribute: row.ReferencingAttribute,
        toAttribute: row.ReferencedAttribute,
      })
    }
  }
  return relationships.slice(0, 120)
}
