import { SAMPLE_DYNAMICS_CATALOG, SAMPLE_DYNAMICS_RELATIONSHIPS } from '../../data/sampleDynamicsMetadata'
import { fetchDynamicsCatalog, fetchDynamicsRelationships } from './dynamicsApi'
import { fetchSalesforceCatalog, fetchSalesforceRelationships } from './salesforceApi'
import type { SaasCatalog, SaasProviderId, SaasRelationship } from './types'

export async function fetchSaasCatalog(
  provider: SaasProviderId,
  instanceUrl: string,
  token: string,
): Promise<SaasCatalog> {
  if (provider === 'salesforce') return fetchSalesforceCatalog(instanceUrl, token)
  return fetchDynamicsCatalog(instanceUrl, token)
}

export async function fetchSaasRelationships(
  catalog: SaasCatalog,
  token: string | undefined,
  logicalNames: string[],
): Promise<SaasRelationship[]> {
  if (catalog.sample) {
    const selected = new Set(logicalNames)
    return SAMPLE_DYNAMICS_RELATIONSHIPS.filter((rel) => selected.has(rel.from) && selected.has(rel.to))
  }
  if (!token) return []
  if (catalog.provider === 'salesforce') {
    return fetchSalesforceRelationships(catalog.instanceUrl, token, logicalNames)
  }
  return fetchDynamicsRelationships(catalog.instanceUrl, token, logicalNames)
}

export function sampleDynamicsCatalog(): SaasCatalog {
  return structuredClone(SAMPLE_DYNAMICS_CATALOG)
}
