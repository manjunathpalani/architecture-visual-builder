import type { IntegrationProtocol } from '../types'
import type { IntegrationEdgeData, IntegrationNodeData } from './jsonIO'
import { getSpecFromProperties } from '../types/interfaceSpec'

const API_KEYWORDS = [
  'api gateway',
  'api management',
  'partner api',
  'generic api',
  'rest api',
  'graphql',
  'webhook',
]

const API_PROTOCOLS: IntegrationProtocol[] = ['REST API', 'GraphQL', 'SOAP', 'Webhook']

export function isApiNode(data: IntegrationNodeData): boolean {
  if (data.properties.componentType === 'api') return true
  if (data.properties.shape === 'interface') return true

  const label = data.label.toLowerCase()
  const service = (data.properties.service ?? '').toLowerCase()
  const combined = `${label} ${service}`

  return API_KEYWORDS.some((kw) => combined.includes(kw))
}

export function isApiIntegration(data: IntegrationEdgeData): boolean {
  return API_PROTOCOLS.includes(data.protocol)
}

export function nodeHasInterfaceSpec(data: IntegrationNodeData): boolean {
  return Boolean(getSpecFromProperties(data.properties))
}

export function integrationHasInterfaceSpec(data: IntegrationEdgeData): boolean {
  return Boolean(data.interfaceSpec?.trim())
}