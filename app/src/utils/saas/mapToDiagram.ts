import type { ArchitectureDocument, Integration, SystemNode } from '../../types'
import type { DiagramPath } from '../../types/diagram'
import {
  addSystemsInView,
  getDiagramView,
  updateDiagramAtPath,
  updateSystemInView,
} from '../diagramNavigation'
import { computeInjectOrigin } from '../swaggerInjector'
import { generateId } from '../jsonIO'
import type { SaasCatalog, SaasEntity, SaasImportMode, SaasRelationship } from './types'

export interface SaasImportPayload {
  catalog: SaasCatalog
  entities: SaasEntity[]
  relationships: SaasRelationship[]
  mode: SaasImportMode
  targetSystemId?: string
  summary: string
}

function entityNode(entity: SaasEntity, catalog: SaasCatalog, position: { x: number; y: number }): SystemNode {
  const bits = [
    entity.collectionLabel && entity.collectionLabel !== entity.label ? entity.collectionLabel : '',
    entity.isCustom ? 'Custom table' : 'Standard table',
    entity.logicalName,
  ].filter(Boolean)
  return {
    id: generateId('sys'),
    type: 'diagram',
    label: entity.label,
    category: catalog.providerLabel,
    position,
    properties: {
      shape: 'datastore',
      vendor: catalog.provider === 'dynamics' ? 'Microsoft' : 'Salesforce',
      service: catalog.providerLabel,
      description: entity.description || bits.join(' · '),
      logicalName: entity.logicalName,
      schemaName: entity.schemaName,
      saasProvider: catalog.provider,
      saasInstanceUrl: catalog.instanceUrl,
      width: '200',
      height: '96',
    },
  }
}

function relationshipEdge(rel: SaasRelationship, sourceId: string, targetId: string): Integration {
  return {
    id: generateId('int'),
    source: sourceId,
    target: targetId,
    label: rel.label,
    direction: 'outbound',
    protocol: 'REST API',
    frequency: 'real-time',
    dataFormat: 'JSON',
    description: `${rel.from} → ${rel.to} (${rel.schemaName})`,
  }
}

function layoutEntities(entities: SaasEntity[], catalog: SaasCatalog, origin: { x: number; y: number }): SystemNode[] {
  const cols = 4
  const dx = 240
  const dy = 150
  return entities.map((entity, index) =>
    entityNode(entity, catalog, {
      x: origin.x + (index % cols) * dx,
      y: origin.y + Math.floor(index / cols) * dy,
    }),
  )
}

function edgesFor(nodes: SystemNode[], relationships: SaasRelationship[]): Integration[] {
  const byName = new Map(nodes.map((node) => [node.properties?.logicalName ?? '', node.id]))
  const edges: Integration[] = []
  const seen = new Set<string>()
  for (const rel of relationships) {
    const source = byName.get(rel.from)
    const target = byName.get(rel.to)
    if (!source || !target) continue
    const key = `${source}->${target}:${rel.schemaName}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push(relationshipEdge(rel, source, target))
  }
  return edges
}

function containerNode(
  catalog: SaasCatalog,
  entities: SaasEntity[],
  systems: SystemNode[],
  integrations: Integration[],
  origin: { x: number; y: number },
): SystemNode {
  const name = catalog.organizationName || catalog.providerLabel
  return {
    id: generateId('sys'),
    type: 'saas',
    label: name,
    category: 'SaaS',
    position: origin,
    properties: {
      vendor: catalog.provider === 'dynamics' ? 'Microsoft' : 'Salesforce',
      service: catalog.providerLabel,
      environment: catalog.instanceUrl,
      description: `${entities.length} tables from ${catalog.instanceUrl}`,
      saasProvider: catalog.provider,
      saasInstanceUrl: catalog.instanceUrl,
      width: '220',
      height: '110',
    },
    subDiagram: {
      name: `${name} data model`,
      description: `Metadata imported from ${catalog.instanceUrl}`,
      systems,
      integrations,
    },
  }
}

export function applySaasImport(
  doc: ArchitectureDocument,
  path: DiagramPath,
  payload: SaasImportPayload,
): { document: ArchitectureDocument; drillSystemId?: string; drillLabel?: string } {
  const systems = layoutEntities(payload.entities, payload.catalog, { x: 80, y: 80 })
  const integrations = edgesFor(systems, payload.relationships)

  if (payload.mode === 'canvas') {
    const view = getDiagramView(doc, path)
    const origin = computeInjectOrigin(view.systems)
    const shifted = systems.map((node) => ({
      ...node,
      position: { x: node.position.x - 80 + origin.x, y: node.position.y - 80 + origin.y },
    }))
    return {
      document: addSystemsAndIntegrations(doc, path, shifted, integrations),
    }
  }

  if (payload.targetSystemId) {
    const document = updateSystemInView(doc, path, payload.targetSystemId, (system) => {
      const existing = system.subDiagram?.systems ?? []
      const existingNames = new Set(existing.map((node) => node.properties?.logicalName).filter(Boolean))
      const added = systems.filter((node) => !existingNames.has(node.properties?.logicalName))
      const mergedSystems = [...existing, ...added]
      const mergedEdges = [
        ...(system.subDiagram?.integrations ?? []),
        ...edgesFor(mergedSystems, payload.relationships),
      ]
      return {
        ...system,
        properties: {
          ...system.properties,
          vendor: system.properties?.vendor || (payload.catalog.provider === 'dynamics' ? 'Microsoft' : 'Salesforce'),
          service: system.properties?.service || payload.catalog.providerLabel,
          environment: payload.catalog.instanceUrl,
          description: `${payload.entities.length} tables from ${payload.catalog.instanceUrl}`,
          saasProvider: payload.catalog.provider,
          saasInstanceUrl: payload.catalog.instanceUrl,
        },
        subDiagram: {
          name: system.subDiagram?.name ?? `${system.label} data model`,
          description: `Metadata imported from ${payload.catalog.instanceUrl}`,
          systems: mergedSystems,
          integrations: dedupeEdges(mergedEdges),
          drawings: system.subDiagram?.drawings,
        },
      }
    })
    return {
      document,
      drillSystemId: payload.targetSystemId,
      drillLabel: payload.catalog.organizationName,
    }
  }

  const view = getDiagramView(doc, path)
  const origin = computeInjectOrigin(view.systems)
  const container = containerNode(payload.catalog, payload.entities, systems, integrations, origin)
  return {
    document: addSystemsInView(doc, path, [container]),
    drillSystemId: container.id,
    drillLabel: container.label,
  }
}

function addSystemsAndIntegrations(
  doc: ArchitectureDocument,
  path: DiagramPath,
  systems: SystemNode[],
  integrations: Integration[],
): ArchitectureDocument {
  const view = getDiagramView(doc, path)
  return updateDiagramAtPath(doc, path, [...view.systems, ...systems], [...view.integrations, ...integrations])
}

function dedupeEdges(edges: Integration[]): Integration[] {
  const seen = new Set<string>()
  const result: Integration[] = []
  for (const edge of edges) {
    const key = `${edge.source}|${edge.target}|${edge.label}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(edge)
  }
  return result
}
