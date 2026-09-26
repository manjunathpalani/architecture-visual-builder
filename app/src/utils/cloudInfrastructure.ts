import type { DiagramInfrastructure, SystemProperties, SystemType } from '../types'

export type { DiagramInfrastructure }

export const CLOUD_PROVIDERS = ['Azure', 'AWS', 'GCP', 'On-premises', 'Other'] as const

export const HA_MODES = [
  { id: 'single-zone', label: 'Single zone' },
  { id: 'zone-redundant', label: 'Zone redundant' },
  { id: 'availability-set', label: 'Availability set' },
  { id: 'multi-region-failover', label: 'Multi-region failover' },
  { id: 'multi-region-active', label: 'Multi-region active/active' },
] as const

export const SKU_TIERS = ['Free', 'Basic', 'Standard', 'Premium', 'Isolated', 'Reserved'] as const

export const ENVIRONMENTS = ['Development', 'Test', 'UAT', 'Staging', 'Production', 'DR'] as const

export const CLOUD_REGIONS: Record<string, Array<{ id: string; label: string }>> = {
  Azure: [
    { id: 'eastus', label: 'East US' },
    { id: 'eastus2', label: 'East US 2' },
    { id: 'westus', label: 'West US' },
    { id: 'westus2', label: 'West US 2' },
    { id: 'westus3', label: 'West US 3' },
    { id: 'centralus', label: 'Central US' },
    { id: 'northeurope', label: 'North Europe' },
    { id: 'westeurope', label: 'West Europe' },
    { id: 'uksouth', label: 'UK South' },
    { id: 'swedencentral', label: 'Sweden Central' },
    { id: 'germanywestcentral', label: 'Germany West Central' },
    { id: 'francecentral', label: 'France Central' },
    { id: 'southeastasia', label: 'Southeast Asia' },
    { id: 'eastasia', label: 'East Asia' },
    { id: 'australiaeast', label: 'Australia East' },
    { id: 'japaneast', label: 'Japan East' },
    { id: 'centralindia', label: 'Central India' },
    { id: 'canadacentral', label: 'Canada Central' },
    { id: 'brazilsouth', label: 'Brazil South' },
    { id: 'uaenorth', label: 'UAE North' },
    { id: 'southafricanorth', label: 'South Africa North' },
  ],
  AWS: [
    { id: 'us-east-1', label: 'US East (N. Virginia)' },
    { id: 'us-east-2', label: 'US East (Ohio)' },
    { id: 'us-west-2', label: 'US West (Oregon)' },
    { id: 'eu-west-1', label: 'Europe (Ireland)' },
    { id: 'eu-central-1', label: 'Europe (Frankfurt)' },
    { id: 'eu-west-2', label: 'Europe (London)' },
    { id: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
    { id: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { id: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { id: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
    { id: 'ca-central-1', label: 'Canada (Central)' },
    { id: 'sa-east-1', label: 'South America (São Paulo)' },
  ],
  GCP: [
    { id: 'us-central1', label: 'Iowa (us-central1)' },
    { id: 'us-east1', label: 'South Carolina (us-east1)' },
    { id: 'europe-west1', label: 'Belgium (europe-west1)' },
    { id: 'europe-west2', label: 'London (europe-west2)' },
    { id: 'asia-south1', label: 'Mumbai (asia-south1)' },
    { id: 'asia-southeast1', label: 'Singapore (asia-southeast1)' },
    { id: 'australia-southeast1', label: 'Sydney (australia-southeast1)' },
  ],
}

const INFRA_TYPES = new Set<SystemType>(['aws', 'azure', 'cloud', 'onpremise', 'database', 'middleware', 'group'])

const INFRA_KEYS = [
  'cloudProvider',
  'region',
  'availabilityZones',
  'subscription',
  'resourceGroup',
  'resourceName',
  'sku',
  'skuTier',
  'instanceSize',
  'storageSize',
  'network',
  'subnet',
  'haMode',
  'sla',
  'estimatedCost',
  'resourceId',
] as const

export type InfraPropertyKey = (typeof INFRA_KEYS)[number]

export function isInfraComponent(type: SystemType, properties?: SystemProperties): boolean {
  if (INFRA_TYPES.has(type)) return true
  return INFRA_KEYS.some((key) => Boolean(properties?.[key]))
}

export function providerForType(type?: SystemType, explicit?: string): string {
  if (explicit) return explicit
  if (type === 'azure') return 'Azure'
  if (type === 'aws') return 'AWS'
  if (type === 'onpremise') return 'On-premises'
  return ''
}

export function regionsForProvider(provider?: string) {
  if (!provider) return []
  return CLOUD_REGIONS[provider] ?? []
}

export function haModeLabel(id?: string): string {
  return HA_MODES.find((item) => item.id === id)?.label ?? id ?? ''
}

export function formatInfraSummary(properties?: SystemProperties): string {
  if (!properties) return ''
  const parts = [
    properties.region,
    properties.sku,
    properties.haMode ? haModeLabel(properties.haMode) : '',
  ].filter((part) => part && part.trim())
  return parts.join(' · ')
}

export function inheritInfrastructure(
  infra: DiagramInfrastructure | undefined,
  type: SystemType,
  existing?: SystemProperties,
): SystemProperties {
  const provider = providerForType(type, existing?.cloudProvider || infra?.cloudProvider)
  const next: SystemProperties = { ...existing }
  if (!next.cloudProvider && provider) next.cloudProvider = provider
  if (!next.region && infra?.primaryRegion) next.region = infra.primaryRegion
  if (!next.subscription && infra?.subscription) next.subscription = infra.subscription
  if (!next.resourceGroup && infra?.landingZone) next.resourceGroup = infra.landingZone
  if (!next.environment && infra?.environment) next.environment = infra.environment
  return next
}

export function diagramInfraSummary(infra?: DiagramInfrastructure): string | undefined {
  if (!infra) return undefined
  const parts = [infra.cloudProvider, infra.primaryRegion, infra.landingZone].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : undefined
}
