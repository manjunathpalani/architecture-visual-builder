export type SaasProviderId = 'dynamics' | 'salesforce'

export interface SaasEntity {
  key: string
  logicalName: string
  schemaName?: string
  label: string
  collectionLabel?: string
  description?: string
  isCustom: boolean
  isActivity?: boolean
  primaryName?: string
  fieldCount?: number
}

export interface SaasRelationship {
  id: string
  schemaName: string
  label: string
  from: string
  to: string
  fromAttribute?: string
  toAttribute?: string
}

export interface SaasCatalog {
  provider: SaasProviderId
  providerLabel: string
  instanceUrl: string
  organizationName?: string
  userLabel?: string
  entities: SaasEntity[]
  sample?: boolean
}

export interface SaasConnection {
  provider: SaasProviderId
  instanceUrl: string
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  clientId?: string
  tenant?: string
  organizationName?: string
}

export type SaasImportMode = 'sub-diagram' | 'canvas'
