import type { Edge, Node } from '@xyflow/react'
import type { ArchitectureDocument, Integration, SystemNode } from '../types'
import type { DiagramPath, DiagramView, DrawingElement, SubDiagram } from '../types/diagram'
import {
  documentToFlow,
  flowToDocument,
  generateId,
  type IntegrationEdgeData,
  type IntegrationNodeData,
} from './jsonIO'
import {
  filterByArchitectureState,
  type ArchitectureStateView,
} from './architectureState'
import { collectChangeTaskSystemIds } from './changeDesign'

function mergeSystemsPreservingSubDiagrams(
  incoming: SystemNode[],
  existing: SystemNode[],
): SystemNode[] {
  const existingMap = new Map(existing.map((s) => [s.id, s]))
  return incoming.map((s) => ({
    ...s,
    subDiagram: existingMap.get(s.id)?.subDiagram ?? s.subDiagram,
  }))
}

export function canDrillInto(system: SystemNode): boolean {
  return system.type !== 'note' && system.type !== 'group' && system.type !== 'shape'
}

export function hasSubDiagramContent(sub?: SubDiagram | null): boolean {
  if (!sub) return false
  return (
    sub.systems.length > 0 ||
    sub.integrations.length > 0 ||
    (sub.drawings?.length ?? 0) > 0
  )
}

export function hasSubDiagram(system: SystemNode): boolean {
  return hasSubDiagramContent(system.subDiagram)
}

export function isIntegrationPath(segment?: { kind?: string }): boolean {
  return segment?.kind === 'integration'
}

export function getSubDiagramStats(system: { subDiagram?: SubDiagram | null }): {
  systems: number
  integrations: number
} {
  return {
    systems: system.subDiagram?.systems.length ?? 0,
    integrations: system.subDiagram?.integrations.length ?? 0,
  }
}

type DiagramContainer = {
  systems: SystemNode[]
  integrations: Integration[]
  drawings: DrawingElement[]
}

function rootContainer(doc: ArchitectureDocument): DiagramContainer {
  return {
    systems: doc.systems,
    integrations: doc.integrations,
    drawings: doc.drawings ?? [],
  }
}

function childSubDiagram(container: DiagramContainer, segment: DiagramPath[number]): SubDiagram | undefined {
  if (isIntegrationPath(segment)) {
    return container.integrations.find((item) => item.id === segment.systemId)?.subDiagram
  }
  return container.systems.find((item) => item.id === segment.systemId)?.subDiagram
}

function setChildSubDiagram(
  container: DiagramContainer,
  segment: DiagramPath[number],
  subDiagram: SubDiagram,
): DiagramContainer {
  if (isIntegrationPath(segment)) {
    return {
      ...container,
      integrations: container.integrations.map((item) =>
        item.id === segment.systemId ? { ...item, subDiagram } : item,
      ),
    }
  }
  return {
    ...container,
    systems: container.systems.map((item) =>
      item.id === segment.systemId ? { ...item, subDiagram } : item,
    ),
  }
}

function mergeIntegrationsPreservingNested(
  incoming: Integration[],
  existing: Integration[],
): Integration[] {
  const previous = new Map(existing.map((item) => [item.id, item]))
  return incoming.map((item) => {
    const old = previous.get(item.id)
    if (!old) return item
    return {
      ...item,
      sequenceFlow: item.sequenceFlow ?? old.sequenceFlow,
      notes: item.notes ?? old.notes,
      subDiagram: Object.prototype.hasOwnProperty.call(item, 'subDiagram')
        ? item.subDiagram
        : old.subDiagram,
    }
  })
}

export function getDiagramView(doc: ArchitectureDocument, path: DiagramPath): DiagramView {
  if (path.length === 0) {
    return {
      systems: doc.systems,
      integrations: doc.integrations,
      drawings: doc.drawings ?? [],
      level: 'root',
      parentPath: [],
    }
  }

  let container = rootContainer(doc)
  let parentLabel = path[path.length - 1]?.label

  for (const segment of path) {
    const sub = childSubDiagram(container, segment)
    parentLabel = segment.label
    if (!sub) {
      return {
        systems: [],
        integrations: [],
        drawings: [],
        level: 'sub',
        parentPath: path,
        parentLabel,
      }
    }
    container = {
      systems: sub.systems,
      integrations: sub.integrations,
      drawings: sub.drawings ?? [],
    }
  }

  return {
    systems: container.systems,
    integrations: container.integrations,
    drawings: container.drawings,
    level: 'sub',
    parentPath: path,
    parentLabel,
  }
}

export function updateDiagramAtPath(
  doc: ArchitectureDocument,
  path: DiagramPath,
  systems: SystemNode[],
  integrations: Integration[],
  drawings?: DrawingElement[],
): ArchitectureDocument {
  if (path.length === 0) {
    return {
      ...doc,
      systems: mergeSystemsPreservingSubDiagrams(systems, doc.systems),
      integrations: mergeIntegrationsPreservingNested(integrations, doc.integrations),
      drawings: drawings ?? doc.drawings ?? [],
    }
  }

  const apply = (container: DiagramContainer, index: number): DiagramContainer => {
    const segment = path[index]
    const existing = childSubDiagram(container, segment)
    if (index === path.length - 1) {
      const nextSub: SubDiagram = {
        name: existing?.name ?? segment.label,
        description: existing?.description,
        systems: mergeSystemsPreservingSubDiagrams(systems, existing?.systems ?? []),
        integrations: mergeIntegrationsPreservingNested(integrations, existing?.integrations ?? []),
        drawings: drawings ?? existing?.drawings ?? [],
      }
      return setChildSubDiagram(container, segment, nextSub)
    }
    const child: DiagramContainer = {
      systems: existing?.systems ?? [],
      integrations: existing?.integrations ?? [],
      drawings: existing?.drawings ?? [],
    }
    const updated = apply(child, index + 1)
    return setChildSubDiagram(container, segment, {
      name: existing?.name ?? segment.label,
      description: existing?.description,
      systems: updated.systems,
      integrations: updated.integrations,
      drawings: updated.drawings,
    })
  }

  const root = apply(rootContainer(doc), 0)
  return {
    ...doc,
    systems: root.systems,
    integrations: root.integrations,
    drawings: root.drawings,
  }
}

export function ensureSubDiagram(
  doc: ArchitectureDocument,
  path: DiagramPath,
  systemId: string,
): ArchitectureDocument {
  const view = getDiagramView(doc, path)
  const system = view.systems.find((s) => s.id === systemId)
  if (!system || system.subDiagram) return doc

  const updatedSystems = view.systems.map((s) =>
    s.id === systemId
      ? { ...s, subDiagram: { name: s.label, systems: [], integrations: [] } }
      : s,
  )
  return updateDiagramAtPath(doc, path, updatedSystems, view.integrations)
}

export function ensureIntegrationSubDiagram(
  doc: ArchitectureDocument,
  path: DiagramPath,
  integrationId: string,
): ArchitectureDocument {
  const view = getDiagramView(doc, path)
  const integration = view.integrations.find((item) => item.id === integrationId)
  if (!integration || integration.subDiagram) return doc
  return updateIntegrationInView(doc, path, integrationId, (current) => ({
    ...current,
    subDiagram: {
      name: `${current.label} sequence`,
      systems: [],
      integrations: [],
    },
  }))
}

export function findSystemAtPath(
  doc: ArchitectureDocument,
  path: DiagramPath,
  systemId: string,
): SystemNode | undefined {
  const view = getDiagramView(doc, path)
  return view.systems.find((s) => s.id === systemId)
}

export interface SubTabItem {
  id: string
  name: string
  path: DiagramPath
  kind: 'overview' | 'sub' | 'feature'
  stats?: { systems: number; integrations: number }
}

function isSubTabSystem(system: SystemNode): boolean {
  return hasSubDiagram(system) || (system.properties?.subTab === 'template' && Boolean(system.subDiagram))
}

export function listSubTabs(doc: ArchitectureDocument, currentPath: DiagramPath): SubTabItem[] {
  const tabs: SubTabItem[] = [
    {
      id: 'overview',
      name: doc.metadata.name || 'Overview',
      path: [],
      kind: 'overview',
      stats: { systems: doc.systems.length, integrations: doc.integrations.length },
    },
    {
      id: 'feature',
      name: 'Feature & apply',
      path: [],
      kind: 'feature',
      stats: { systems: doc.changeDesigns?.length ?? 0, integrations: 0 },
    },
  ]

  for (const system of doc.systems) {
    if (!isSubTabSystem(system)) continue
    tabs.push({
      id: system.id,
      name: system.label,
      path: [{ systemId: system.id, label: system.label }],
      kind: 'sub',
      stats: getSubDiagramStats(system),
    })
  }

  for (const integration of doc.integrations) {
    if (!hasSubDiagramContent(integration.subDiagram)) continue
    tabs.push({
      id: integration.id,
      name: `${integration.label} sequence`,
      path: [{ systemId: integration.id, label: integration.label, kind: 'integration' }],
      kind: 'sub',
      stats: getSubDiagramStats(integration),
    })
  }

  if (currentPath.length > 0) {
    const segment = currentPath[currentPath.length - 1]
    if (!tabs.some((tab) => tab.id === segment.systemId)) {
      if (isIntegrationPath(segment)) {
        const parentView = getDiagramView(doc, currentPath.slice(0, -1))
        const integration = parentView.integrations.find((item) => item.id === segment.systemId)
        tabs.push({
          id: segment.systemId,
          name: `${segment.label} sequence`,
          path: currentPath,
          kind: 'sub',
          stats: integration ? getSubDiagramStats(integration) : undefined,
        })
      } else {
        const current = findSystemAtPath(doc, currentPath.slice(0, -1), segment.systemId)
        tabs.push({
          id: segment.systemId,
          name: segment.label,
          path: currentPath,
          kind: 'sub',
          stats: current ? getSubDiagramStats(current) : undefined,
        })
      }
    }
  }

  return tabs
}

export function removeSubTab(
  doc: ArchitectureDocument,
  tabPath: DiagramPath,
): ArchitectureDocument {
  if (tabPath.length === 0) return doc
  const parentPath = tabPath.slice(0, -1)
  const segment = tabPath[tabPath.length - 1]
  if (isIntegrationPath(segment)) {
    return updateIntegrationInView(doc, parentPath, segment.systemId, (current) => ({
      ...current,
      subDiagram: undefined,
    }))
  }
  const system = findSystemAtPath(doc, parentPath, segment.systemId)
  if (!system) return doc

  if (system.properties?.subTab === 'template') {
    return deleteSystemInView(doc, parentPath, segment.systemId)
  }

  return updateSystemInView(doc, parentPath, segment.systemId, (current) => ({
    ...current,
    subDiagram: undefined,
  }))
}

export function addTemplatedSubDiagram(
  doc: ArchitectureDocument,
  path: DiagramPath,
  templateDoc: ArchitectureDocument,
): { document: ArchitectureDocument; systemId: string; label: string } {
  const view = getDiagramView(doc, path)
  const originX = view.systems.reduce(
    (max, system) => Math.max(max, system.position.x + Number(system.properties?.width ?? 180)),
    0,
  )
  const label = templateDoc.metadata.name
  const systemId = generateId('sys')
  const container: SystemNode = {
    id: systemId,
    type: 'diagram',
    label,
    category: 'Software Engineering',
    position: { x: view.systems.length ? originX + 80 : 80, y: 80 },
    properties: {
      shape: 'c4-system',
      description: templateDoc.metadata.description ?? `Sub-diagram from ${label}`,
      width: '220',
      height: '120',
      subTab: 'template',
    },
    subDiagram: {
      name: label,
      description: templateDoc.metadata.description,
      systems: structuredClone(templateDoc.systems),
      integrations: structuredClone(templateDoc.integrations),
      drawings: templateDoc.drawings ? structuredClone(templateDoc.drawings) : undefined,
    },
  }

  return {
    document: addSystemsInView(doc, path, [container]),
    systemId,
    label,
  }
}

export function addSystemsInView(
  doc: ArchitectureDocument,
  path: DiagramPath,
  systems: SystemNode[],
): ArchitectureDocument {
  if (systems.length === 0) return doc
  const view = getDiagramView(doc, path)
  return updateDiagramAtPath(doc, path, [...view.systems, ...systems], view.integrations)
}

export function renameSystemAtPath(
  doc: ArchitectureDocument,
  path: DiagramPath,
  name: string,
): ArchitectureDocument {
  if (path.length === 0) {
    return {
      ...doc,
      metadata: { ...doc.metadata, name },
    }
  }
  const parentPath = path.slice(0, -1)
  const segment = path[path.length - 1]
  if (isIntegrationPath(segment)) {
    return updateIntegrationInView(doc, parentPath, segment.systemId, (integration) => ({
      ...integration,
      label: name,
      subDiagram: integration.subDiagram ? { ...integration.subDiagram, name } : integration.subDiagram,
    }))
  }
  return updateSystemInView(doc, parentPath, segment.systemId, (system) => ({
    ...system,
    label: name,
    subDiagram: system.subDiagram ? { ...system.subDiagram, name } : system.subDiagram,
  }))
}

export function renameDrillPath(path: DiagramPath, systemId: string, label: string): DiagramPath {
  return path.map((segment) => (segment.systemId === systemId ? { ...segment, label } : segment))
}

export function updateSystemInView(
  doc: ArchitectureDocument,
  path: DiagramPath,
  systemId: string,
  updater: (system: SystemNode) => SystemNode,
): ArchitectureDocument {
  const view = getDiagramView(doc, path)
  const updatedSystems = view.systems.map((s) =>
    s.id === systemId ? updater(s) : s,
  )
  return updateDiagramAtPath(doc, path, updatedSystems, view.integrations)
}

export function deleteSystemInView(
  doc: ArchitectureDocument,
  path: DiagramPath,
  systemId: string,
): ArchitectureDocument {
  const view = getDiagramView(doc, path)
  const updatedSystems = view.systems.filter((s) => s.id !== systemId)
  const updatedIntegrations = view.integrations.filter(
    (i) => i.source !== systemId && i.target !== systemId,
  )
  return updateDiagramAtPath(doc, path, updatedSystems, updatedIntegrations)
}

export function updateIntegrationInView(
  doc: ArchitectureDocument,
  path: DiagramPath,
  integrationId: string,
  updater: (integration: Integration) => Integration,
): ArchitectureDocument {
  const view = getDiagramView(doc, path)
  const updatedIntegrations = view.integrations.map((i) =>
    i.id === integrationId ? updater(i) : i,
  )
  return updateDiagramAtPath(doc, path, view.systems, updatedIntegrations)
}

export function deleteIntegrationInView(
  doc: ArchitectureDocument,
  path: DiagramPath,
  integrationId: string,
): ArchitectureDocument {
  const view = getDiagramView(doc, path)
  const updatedIntegrations = view.integrations.filter((i) => i.id !== integrationId)
  return updateDiagramAtPath(doc, path, view.systems, updatedIntegrations)
}

export function syncFlowToDocument(
  doc: ArchitectureDocument,
  path: DiagramPath,
  nodes: Node<IntegrationNodeData>[],
  edges: Edge<IntegrationEdgeData>[],
): ArchitectureDocument {
  const slice = flowToDocument(nodes, edges, doc.metadata)
  const view = getDiagramView(doc, path)
  return updateDiagramAtPath(doc, path, slice.systems, slice.integrations, view.drawings)
}

export function updateDrawingsAtPath(
  doc: ArchitectureDocument,
  path: DiagramPath,
  drawings: DrawingElement[],
): ArchitectureDocument {
  const view = getDiagramView(doc, path)
  return updateDiagramAtPath(doc, path, view.systems, view.integrations, drawings)
}

export function documentToFlowAtPath(
  doc: ArchitectureDocument,
  path: DiagramPath,
  stateView: ArchitectureStateView = 'all',
): {
  nodes: Node<IntegrationNodeData>[]
  edges: Edge<IntegrationEdgeData>[]
} {
  const view = getDiagramView(doc, path)
  const filtered = filterByArchitectureState(view.systems, view.integrations, stateView)
  const tasked = collectChangeTaskSystemIds(doc)
  const flow = documentToFlow({
    metadata: doc.metadata,
    systems: filtered.systems,
    integrations: filtered.integrations,
  })

  flow.nodes = flow.nodes.map((node) => {
    const system = filtered.systems.find((s) => s.id === node.id)
    if (!system) return node
    return {
      ...node,
      data: {
        ...node.data,
        subDiagramStats: getSubDiagramStats(system),
        canDrillIn: canDrillInto(system),
        hasSubDiagramContent: hasSubDiagram(system),
        isStateContext: filtered.contextIds.has(system.id),
        hasChangeTask: tasked.has(system.id),
      },
    }
  })

  return flow
}