import type { Edge, Node } from '@xyflow/react'
import type { ArchitectureDocument, Integration, SystemNode } from '../types'
import type { DiagramPath, DiagramView, DrawingElement } from '../types/diagram'
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

export function hasSubDiagram(system: SystemNode): boolean {
  const sub = system.subDiagram
  if (!sub) return false
  return (
    sub.systems.length > 0 ||
    sub.integrations.length > 0 ||
    (sub.drawings?.length ?? 0) > 0
  )
}

export function getSubDiagramStats(system: SystemNode): {
  systems: number
  integrations: number
} {
  return {
    systems: system.subDiagram?.systems.length ?? 0,
    integrations: system.subDiagram?.integrations.length ?? 0,
  }
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

  let systems = doc.systems
  let parent: SystemNode | undefined

  for (const segment of path) {
    parent = systems.find((s) => s.id === segment.systemId)
    if (!parent) {
      return {
        systems: [],
        integrations: [],
        drawings: [],
        level: 'sub',
        parentPath: path,
        parentLabel: segment.label,
      }
    }
    if (!parent.subDiagram) {
      return {
        systems: [],
        integrations: [],
        drawings: [],
        level: 'sub',
        parentPath: path,
        parentLabel: parent.label,
      }
    }
    systems = parent.subDiagram.systems
  }

  const sub = parent!.subDiagram!
  return {
    systems: sub.systems,
    integrations: sub.integrations,
    drawings: sub.drawings ?? [],
    level: 'sub',
    parentPath: path,
    parentLabel: parent!.label,
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
      integrations,
      drawings: drawings ?? doc.drawings ?? [],
    }
  }

  const updateNested = (
    currentSystems: SystemNode[],
    pathIndex: number,
  ): SystemNode[] => {
    const segment = path[pathIndex]
    return currentSystems.map((s) => {
      if (s.id !== segment.systemId) return s

      if (pathIndex === path.length - 1) {
        const existing = s.subDiagram?.systems ?? []
        return {
          ...s,
          subDiagram: {
            name: s.subDiagram?.name ?? s.label,
            description: s.subDiagram?.description,
            systems: mergeSystemsPreservingSubDiagrams(systems, existing),
            integrations,
            drawings: drawings ?? s.subDiagram?.drawings ?? [],
          },
        }
      }

      const sub = s.subDiagram ?? { systems: [], integrations: [] }
      return {
        ...s,
        subDiagram: {
          ...sub,
          systems: updateNested(sub.systems, pathIndex + 1),
        },
      }
    })
  }

  return { ...doc, systems: updateNested(doc.systems, 0) }
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
  kind: 'overview' | 'sub'
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

  if (currentPath.length > 0) {
    const currentId = currentPath[currentPath.length - 1].systemId
    if (!tabs.some((tab) => tab.id === currentId)) {
      const current = findSystemAtPath(doc, currentPath.slice(0, -1), currentId)
      tabs.push({
        id: currentId,
        name: currentPath[currentPath.length - 1].label,
        path: currentPath,
        kind: 'sub',
        stats: current ? getSubDiagramStats(current) : undefined,
      })
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
  const systemId = tabPath[tabPath.length - 1].systemId
  const system = findSystemAtPath(doc, parentPath, systemId)
  if (!system) return doc

  if (system.properties?.subTab === 'template') {
    return deleteSystemInView(doc, parentPath, systemId)
  }

  return updateSystemInView(doc, parentPath, systemId, (current) => ({
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
  const systemId = path[path.length - 1].systemId
  return updateSystemInView(doc, parentPath, systemId, (system) => ({
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
      },
    }
  })

  return flow
}