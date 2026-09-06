import type { ArchitectureDocument, Integration, SystemNode } from '../types'
import type { DiagramPath, DrawingElement } from '../types/diagram'
import { generateId } from './jsonIO'
import { getDiagramView, updateDiagramAtPath } from './diagramNavigation'

export const CLIPBOARD_KIND = 'architecture-visual-builder/components'

export interface DiagramClipboardPayload {
  kind: typeof CLIPBOARD_KIND
  systems: SystemNode[]
  integrations: Integration[]
  drawings: DrawingElement[]
}

const PASTE_GAP = 48
let memoryClipboard: DiagramClipboardPayload | null = null
let pasteGeneration = 0
let lastFingerprint = ''

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function collectClipboardPayload(
  document: ArchitectureDocument,
  path: DiagramPath,
  selectedNodeIds: string[],
  selectedEdgeIds: string[],
  selectedDrawingIds: string[],
): DiagramClipboardPayload | null {
  const view = getDiagramView(document, path)
  const nodeIds = new Set(selectedNodeIds)

  if (nodeIds.size === 0 && selectedEdgeIds.length > 0) {
    for (const edge of view.integrations) {
      if (selectedEdgeIds.includes(edge.id)) {
        nodeIds.add(edge.source)
        nodeIds.add(edge.target)
      }
    }
  }

  const systems = view.systems
    .filter((system) => nodeIds.has(system.id))
    .map((system) => structuredClone(system))
  const integrations = view.integrations
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => structuredClone(edge))
  const drawings = view.drawings
    .filter((drawing) => selectedDrawingIds.includes(drawing.id))
    .map((drawing) => structuredClone(drawing))

  if (systems.length === 0 && drawings.length === 0) return null
  return { kind: CLIPBOARD_KIND, systems, integrations, drawings }
}

export function cloneClipboard(
  payload: DiagramClipboardPayload,
  generation = 1,
): DiagramClipboardPayload {
  const dx = PASTE_GAP * Math.max(1, generation)
  const dy = PASTE_GAP * Math.max(1, generation)
  const idMap = new Map<string, string>()
  const systems = payload.systems.map((system) => remapSystem(system, idMap, dx, dy))
  const integrations = payload.integrations.map((edge) => remapIntegration(edge, idMap, dx, dy))
  const drawings = payload.drawings.map((drawing) => remapDrawing(drawing, dx, dy))
  return { kind: CLIPBOARD_KIND, systems, integrations, drawings }
}

export function applyClipboardToView(
  document: ArchitectureDocument,
  path: DiagramPath,
  payload: DiagramClipboardPayload,
): ArchitectureDocument {
  const view = getDiagramView(document, path)
  return updateDiagramAtPath(
    document,
    path,
    [...view.systems, ...payload.systems],
    [...view.integrations, ...payload.integrations],
    [...view.drawings, ...payload.drawings],
  )
}

export function removeSelectionFromView(
  document: ArchitectureDocument,
  path: DiagramPath,
  nodeIds: string[],
  drawingIds: string[],
  edgeIds: string[] = [],
): ArchitectureDocument {
  const removeNodes = new Set(nodeIds)
  const removeEdges = new Set(edgeIds)
  const view = getDiagramView(document, path)
  return updateDiagramAtPath(
    document,
    path,
    view.systems.filter((system) => !removeNodes.has(system.id)),
    view.integrations.filter(
      (edge) =>
        !removeNodes.has(edge.source) &&
        !removeNodes.has(edge.target) &&
        !removeEdges.has(edge.id),
    ),
    view.drawings.filter((drawing) => !drawingIds.includes(drawing.id)),
  )
}

export async function writeClipboard(payload: DiagramClipboardPayload): Promise<void> {
  memoryClipboard = payload
  lastFingerprint = fingerprint(payload)
  pasteGeneration = 0
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload))
  } catch {
    /* keep in-memory clipboard */
  }
}

export async function readClipboard(): Promise<DiagramClipboardPayload | null> {
  try {
    const text = await navigator.clipboard.readText()
    const parsed = parseClipboardText(text)
    if (parsed) {
      const next = fingerprint(parsed)
      if (next !== lastFingerprint) {
        lastFingerprint = next
        pasteGeneration = 0
        memoryClipboard = parsed
      }
      return parsed
    }
  } catch {
    /* fall through to memory */
  }
  return memoryClipboard
}

export function nextPasteGeneration(): number {
  pasteGeneration += 1
  return pasteGeneration
}

export function parseClipboardText(text: string): DiagramClipboardPayload | null {
  try {
    const parsed = JSON.parse(text) as Partial<DiagramClipboardPayload>
    if (parsed?.kind !== CLIPBOARD_KIND) return null
    if (!Array.isArray(parsed.systems) || !Array.isArray(parsed.integrations)) return null
    return {
      kind: CLIPBOARD_KIND,
      systems: parsed.systems,
      integrations: parsed.integrations,
      drawings: Array.isArray(parsed.drawings) ? parsed.drawings : [],
    }
  } catch {
    return null
  }
}

function fingerprint(payload: DiagramClipboardPayload): string {
  return `${payload.systems.map((s) => s.id).join(',')}|${payload.drawings.map((d) => d.id).join(',')}`
}

function remapSystem(
  system: SystemNode,
  idMap: Map<string, string>,
  dx: number,
  dy: number,
): SystemNode {
  const nextId = generateId('sys')
  idMap.set(system.id, nextId)
  const copy = structuredClone(system)
  copy.id = nextId
  copy.position = { x: system.position.x + dx, y: system.position.y + dy }
  if (copy.subDiagram) {
    const nested = new Map<string, string>()
    copy.subDiagram.systems = copy.subDiagram.systems.map((child) => remapSystem(child, nested, 0, 0))
    copy.subDiagram.integrations = copy.subDiagram.integrations.map((edge) =>
      remapIntegration(edge, nested, 0, 0),
    )
    copy.subDiagram.drawings = copy.subDiagram.drawings?.map((drawing) => remapDrawing(drawing, 0, 0))
  }
  return copy
}

function remapIntegration(edge: Integration, idMap: Map<string, string>, dx: number, dy: number): Integration {
  const copy = structuredClone(edge)
  copy.id = generateId('int')
  copy.source = idMap.get(edge.source) ?? edge.source
  copy.target = idMap.get(edge.target) ?? edge.target
  if (copy.waypoints) {
    copy.waypoints = copy.waypoints.map((point) => ({ x: point.x + dx, y: point.y + dy }))
  }
  return copy
}

function remapDrawing(drawing: DrawingElement, dx: number, dy: number): DrawingElement {
  return {
    ...structuredClone(drawing),
    id: generateId('draw'),
    points: drawing.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
  }
}
