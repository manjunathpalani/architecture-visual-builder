import type { ArchitectureDocument, Integration, SequenceFlowStep, SystemNode } from '../types'
import type { DiagramPath, SubDiagram } from '../types/diagram'
import { generateId } from './jsonIO'
import { getDiagramView, hasSubDiagramContent, updateIntegrationInView } from './diagramNavigation'

export type SequenceCatalogId = 'current' | 'source' | 'target' | 'nested'

export interface SequenceCatalog {
  id: SequenceCatalogId
  label: string
  systems: SystemNode[]
  integrations: Integration[]
  parentId?: string
  parentLabel?: string
}

const SKIP_TYPES = new Set(['note', 'group', 'shape'])

export function isSequenceComponent(system: SystemNode): boolean {
  return !SKIP_TYPES.has(system.type)
}

export function sequenceComponents(systems: SystemNode[]): SystemNode[] {
  return systems.filter(isSequenceComponent)
}

export function hasIntegrationSequence(integration: Integration): boolean {
  return (integration.sequenceFlow?.length ?? 0) > 0 || hasSubDiagramContent(integration.subDiagram)
}

export function listSequenceCatalogs(
  document: ArchitectureDocument,
  path: DiagramPath,
  integration: Integration,
): SequenceCatalog[] {
  const view = getDiagramView(document, path)
  const source = view.systems.find((system) => system.id === integration.source)
  const target = view.systems.find((system) => system.id === integration.target)
  const catalogs: SequenceCatalog[] = [
    {
      id: 'current',
      label: path.length === 0 ? 'This diagram' : 'This inner diagram',
      systems: sequenceComponents(view.systems),
      integrations: view.integrations,
    },
  ]
  if (source?.subDiagram && sequenceComponents(source.subDiagram.systems).length > 0) {
    catalogs.push({
      id: 'source',
      label: `${source.label} inner diagram`,
      systems: sequenceComponents(source.subDiagram.systems),
      integrations: source.subDiagram.integrations,
      parentId: source.id,
      parentLabel: source.label,
    })
  }
  if (target?.subDiagram && sequenceComponents(target.subDiagram.systems).length > 0) {
    catalogs.push({
      id: 'target',
      label: `${target.label} inner diagram`,
      systems: sequenceComponents(target.subDiagram.systems),
      integrations: target.subDiagram.integrations,
      parentId: target.id,
      parentLabel: target.label,
    })
  }
  if (integration.subDiagram && sequenceComponents(integration.subDiagram.systems).length > 0) {
    catalogs.push({
      id: 'nested',
      label: 'This integration sequence diagram',
      systems: sequenceComponents(integration.subDiagram.systems),
      integrations: integration.subDiagram.integrations,
    })
  }
  return catalogs
}

export function catalogSequence(catalog: SequenceCatalog): SequenceFlowStep[] {
  const derived = deriveSequenceSteps(catalog.systems, catalog.integrations)
  if (derived.length > 0) return derived
  return [...catalog.systems]
    .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
    .map((system) => toStep(system))
}

export function deriveSequenceSteps(
  systems: SystemNode[],
  integrations: Integration[],
): SequenceFlowStep[] {
  const allowed = new Set(sequenceComponents(systems).map((system) => system.id))
  const labels = new Map(systems.map((system) => [system.id, system.label]))
  const edges = integrations.filter((item) => allowed.has(item.source) && allowed.has(item.target))
  if (edges.length === 0) return []

  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, number>()
  for (const edge of edges) {
    const from = edge.direction === 'inbound' ? edge.target : edge.source
    const to = edge.direction === 'inbound' ? edge.source : edge.target
    outgoing.set(from, [...(outgoing.get(from) ?? []), to])
    incoming.set(to, (incoming.get(to) ?? 0) + 1)
  }

  const starts = [...outgoing.keys()].filter((id) => (incoming.get(id) ?? 0) === 0)
  const seeds = starts.length > 0 ? starts : [...outgoing.keys()]
  let best: string[] = []

  const visit = (node: string, trail: string[]) => {
    if (trail.length > 10) return
    const next = (outgoing.get(node) ?? []).filter((id) => !trail.includes(id))
    if (next.length === 0) {
      if (trail.length > best.length) best = [...trail]
      return
    }
    for (const id of next) visit(id, [...trail, id])
  }

  for (const seed of seeds) visit(seed, [seed])
  if (best.length < 2) return []
  return best.map((id) => ({
    id: generateId('seq'),
    systemId: id,
    label: labels.get(id) ?? id,
  }))
}

export function locateSequenceStep(
  document: ArchitectureDocument,
  path: DiagramPath,
  integration: Integration,
  step: SequenceFlowStep,
): { catalogId: SequenceCatalogId; parentId?: string; parentLabel?: string } | null {
  const catalogs = listSequenceCatalogs(document, path, integration)
  for (const catalog of catalogs) {
    if (catalog.systems.some((system) => system.id === step.systemId)) {
      return {
        catalogId: catalog.id,
        parentId: catalog.parentId,
        parentLabel: catalog.parentLabel,
      }
    }
  }
  return null
}

export function seedIntegrationSequence(
  document: ArchitectureDocument,
  path: DiagramPath,
  integration: Integration,
): ArchitectureDocument {
  if (hasSubDiagramContent(integration.subDiagram)) return document
  const steps = integration.sequenceFlow ?? []
  const catalogs = listSequenceCatalogs(document, path, integration)
  const byId = new Map<string, SystemNode>()
  for (const catalog of catalogs) {
    for (const system of catalog.systems) byId.set(system.id, system)
  }

  const view = getDiagramView(document, path)
  const source = view.systems.find((system) => system.id === integration.source)
  const target = view.systems.find((system) => system.id === integration.target)
  const hopSystems: SystemNode[] = []
  const seen = new Set<string>()

  const addSystem = (system: SystemNode | undefined, fallbackLabel?: string, fallbackId?: string) => {
    const id = system?.id ?? fallbackId
    if (!id || seen.has(id)) return
    seen.add(id)
    hopSystems.push(
      system
        ? {
            ...structuredClone(system),
            position: { x: 80 + hopSystems.length * 220, y: 120 },
            subDiagram: undefined,
          }
        : {
            id,
            type: 'diagram',
            label: fallbackLabel ?? id,
            category: 'Software Engineering',
            position: { x: 80 + hopSystems.length * 220, y: 120 },
            properties: { shape: 'process', width: '180', height: '90' },
          },
    )
  }

  addSystem(source)
  for (const step of steps) addSystem(byId.get(step.systemId), step.label, step.systemId)
  addSystem(target)

  if (hopSystems.length === 0) return document

  const hops: Integration[] = []
  for (let i = 0; i < hopSystems.length - 1; i++) {
    hops.push({
      id: generateId('int'),
      source: hopSystems[i].id,
      target: hopSystems[i + 1].id,
      label: `Hop ${i + 1}`,
      direction: 'outbound',
      protocol: integration.protocol,
      frequency: integration.frequency,
      dataFormat: integration.dataFormat,
    })
  }

  const subDiagram: SubDiagram = {
    name: `${integration.label} sequence`,
    description: `Sequence flow for ${integration.label}`,
    systems: hopSystems,
    integrations: hops,
  }

  return updateIntegrationInView(document, path, integration.id, (current) => ({
    ...current,
    subDiagram,
    sequenceFlow: steps.length > 0 ? steps : hopSystems.slice(1, -1).map((system) => toStep(system)),
  }))
}

function toStep(system: SystemNode): SequenceFlowStep {
  return { id: generateId('seq'), systemId: system.id, label: system.label }
}
