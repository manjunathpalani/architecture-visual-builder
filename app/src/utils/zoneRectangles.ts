import type { Node } from '@xyflow/react'
import type { ArchitectureDocument, SystemNode } from '../types'
import type { DiagramPath, DrawingElement } from '../types/diagram'
import { getDiagramView, updateDiagramAtPath } from './diagramNavigation'
import type { IntegrationNodeData } from './jsonIO'
import { absolutePosition } from './nodeGrouping'
import { rectFromPoints } from './drawingRender'

export interface ZoneNode {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_SIZE: Record<string, { width: number; height: number }> = {
  integration: { width: 180, height: 90 },
  diagram: { width: 160, height: 100 },
  annotation: { width: 180, height: 120 },
  group: { width: 320, height: 200 },
  shape: { width: 160, height: 100 },
}

function systemFlowKind(system: SystemNode): string {
  if (system.type === 'diagram') return 'diagram'
  if (system.type === 'note') return 'annotation'
  if (system.type === 'group') return 'group'
  if (system.type === 'shape') return 'shape'
  return 'integration'
}

function systemSize(system: SystemNode): { width: number; height: number } {
  const defaults = DEFAULT_SIZE[systemFlowKind(system)] ?? DEFAULT_SIZE.integration
  const width = Number(system.properties?.width)
  const height = Number(system.properties?.height)
  return {
    width: Number.isFinite(width) && width > 0 ? width : defaults.width,
    height: Number.isFinite(height) && height > 0 ? height : defaults.height,
  }
}

export function zoneNodesFromSystems(systems: SystemNode[]): ZoneNode[] {
  const byId = new Map(systems.map((system) => [system.id, system]))
  return systems
    .filter((system) => system.type !== 'note' && system.type !== 'group')
    .map((system) => {
      const size = systemSize(system)
      const position = absoluteSystemPosition(system, byId)
      return {
        id: system.id,
        label: system.label,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      }
    })
}

function absoluteSystemPosition(
  system: SystemNode,
  byId: Map<string, SystemNode>,
): { x: number; y: number } {
  let x = system.position.x
  let y = system.position.y
  let parentId = system.parentId
  const seen = new Set<string>()
  while (parentId && byId.has(parentId) && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = byId.get(parentId)!
    x += parent.position.x
    y += parent.position.y
    parentId = parent.parentId
  }
  return { x, y }
}

export function zoneNodesFromFlow(nodes: Node<IntegrationNodeData>[]): ZoneNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return nodes
    .filter((node) => node.type !== 'group' && node.data.systemType !== 'group' && node.type !== 'annotation')
    .map((node) => {
      const position = absolutePosition(node, byId)
      const width = Number(node.measured?.width ?? node.style?.width ?? 180)
      const height = Number(node.measured?.height ?? node.style?.height ?? 90)
      return {
        id: node.id,
        label: node.data.label,
        x: position.x,
        y: position.y,
        width: Number.isFinite(width) && width > 0 ? width : 180,
        height: Number.isFinite(height) && height > 0 ? height : 90,
      }
    })
}

/** Move zone rectangles (and their titles) so they still frame the same components. */
export function realignZoneDrawings(
  drawings: DrawingElement[],
  before: ZoneNode[],
  after: ZoneNode[],
): DrawingElement[] {
  if (drawings.length === 0) return drawings
  const beforeById = new Map(before.map((node) => [node.id, node]))
  const afterById = new Map(after.map((node) => [node.id, node]))
  const afterByLabel = new Map<string, ZoneNode[]>()
  for (const node of after) {
    const key = node.label.trim().toLowerCase()
    const list = afterByLabel.get(key) ?? []
    list.push(node)
    afterByLabel.set(key, list)
  }
  const claimedLabels = new Set<string>()

  const placed: Array<{ id: string; before: Bounds; after: Bounds }> = []
  const next = drawings.map((drawing) => {
    if (drawing.type !== 'rectangle' || drawing.points.length < 2) return drawing
    const bounds = rectFromPoints(drawing.points[0], drawing.points[1])
    if (bounds.width < 8 || bounds.height < 8) return drawing

    const stored = (drawing.systemIds ?? []).filter((id) => beforeById.has(id) || afterById.has(id))
    const sourceIds = stored.length > 0 ? stored : inferMembers(bounds, before)
    const resolved: ZoneNode[] = []
    const seen = new Set<string>()
    for (const id of sourceIds) {
      const node = resolveNode(id, beforeById, afterById, afterByLabel, claimedLabels)
      if (!node || seen.has(node.id)) continue
      seen.add(node.id)
      resolved.push(node)
    }
    if (resolved.length === 0) return drawing

    const beforeMembers = sourceIds
      .map((id) => beforeById.get(id))
      .filter((node): node is ZoneNode => Boolean(node))
    const padding = paddingAround(bounds, unionOf(beforeMembers.length ? beforeMembers : resolved))
    const wrapped = expand(unionOf(resolved), padding)
    placed.push({ id: drawing.id, before: bounds, after: wrapped })
    return {
      ...drawing,
      systemIds: resolved.map((node) => node.id),
      points: [
        { x: wrapped.x, y: wrapped.y },
        { x: wrapped.x + wrapped.width, y: wrapped.y + wrapped.height },
      ],
    }
  })

  if (placed.length === 0) return next
  return next.map((drawing) => {
    if (drawing.type !== 'text' || drawing.points.length === 0) return drawing
    const anchor = drawing.points[0]
    const host = smallestContaining(placed, anchor.x, anchor.y)
    if (!host) return drawing
    const dx = host.after.x - host.before.x
    const dy = host.after.y - host.before.y
    if (dx === 0 && dy === 0) return drawing
    return {
      ...drawing,
      points: drawing.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    }
  })
}

export function describeZoneLinks(drawings: DrawingElement[], systems: SystemNode[]): string | undefined {
  const nodes = zoneNodesFromSystems(systems)
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const lines: string[] = []
  for (const drawing of drawings) {
    if (drawing.type !== 'rectangle' || drawing.points.length < 2) continue
    const bounds = rectFromPoints(drawing.points[0], drawing.points[1])
    const ids = (drawing.systemIds ?? []).filter((id) => byId.has(id))
    const members = (ids.length > 0 ? ids : inferMembers(bounds, nodes))
      .map((id) => byId.get(id))
      .filter((node): node is ZoneNode => Boolean(node))
    if (members.length === 0) continue
    const title = titleInside(drawings, bounds) ?? 'Zone'
    const body = members.map((node) => `${node.id} (${node.label})`).join(', ')
    lines.push(`- ${title}: ${body}`)
  }
  if (lines.length === 0) return undefined
  return [
    'Zone boxes — keep these component ids unchanged so each box stays around the same components:',
    ...lines,
  ].join('\n')
}

/** Keep the open canvas's zone rectangles wrapped around the same components after a redraw. */
export function redrawKeepingZones(
  previous: ArchitectureDocument,
  path: DiagramPath,
  generated: ArchitectureDocument,
): ArchitectureDocument {
  const view = getDiagramView(previous, path)
  const drawings = realignZoneDrawings(
    view.drawings ?? [],
    zoneNodesFromSystems(view.systems),
    zoneNodesFromSystems(generated.systems),
  )
  if (path.length === 0) return { ...generated, drawings }
  return updateDiagramAtPath(previous, path, generated.systems, generated.integrations, drawings)
}

function resolveNode(
  id: string,
  beforeById: Map<string, ZoneNode>,
  afterById: Map<string, ZoneNode>,
  afterByLabel: Map<string, ZoneNode[]>,
  claimedLabels: Set<string>,
): ZoneNode | undefined {
  const direct = afterById.get(id)
  if (direct) return direct
  const label = beforeById.get(id)?.label.trim().toLowerCase()
  if (!label || claimedLabels.has(`${label}:${id}`)) return undefined
  const candidate = (afterByLabel.get(label) ?? []).find((node) => !claimedLabels.has(node.id))
  if (!candidate) return undefined
  claimedLabels.add(candidate.id)
  claimedLabels.add(`${label}:${id}`)
  return candidate
}

function inferMembers(bounds: Bounds, nodes: ZoneNode[]): string[] {
  return nodes
    .filter((node) => {
      const cx = node.x + node.width / 2
      const cy = node.y + node.height / 2
      return contains(bounds, cx, cy)
    })
    .map((node) => node.id)
}

function contains(bounds: Bounds, x: number, y: number): boolean {
  return x >= bounds.x && y >= bounds.y && x <= bounds.x + bounds.width && y <= bounds.y + bounds.height
}

function unionOf(nodes: ZoneNode[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) }
}

function paddingAround(rect: Bounds, inner: Bounds): { left: number; top: number; right: number; bottom: number } {
  return {
    left: Math.max(12, inner.x - rect.x),
    top: Math.max(12, inner.y - rect.y),
    right: Math.max(12, rect.x + rect.width - (inner.x + inner.width)),
    bottom: Math.max(12, rect.y + rect.height - (inner.y + inner.height)),
  }
}

function expand(inner: Bounds, padding: { left: number; top: number; right: number; bottom: number }): Bounds {
  return {
    x: inner.x - padding.left,
    y: inner.y - padding.top,
    width: inner.width + padding.left + padding.right,
    height: inner.height + padding.top + padding.bottom,
  }
}

function smallestContaining(
  placed: Array<{ id: string; before: Bounds; after: Bounds }>,
  x: number,
  y: number,
): { before: Bounds; after: Bounds } | undefined {
  let best: { before: Bounds; after: Bounds } | undefined
  let bestArea = Infinity
  for (const item of placed) {
    if (!contains(item.before, x, y)) continue
    const area = item.before.width * item.before.height
    if (area < bestArea) {
      best = item
      bestArea = area
    }
  }
  return best
}

function titleInside(drawings: DrawingElement[], bounds: Bounds): string | undefined {
  const titles = drawings.filter((drawing) => {
    if (drawing.type !== 'text' || !drawing.text?.trim() || drawing.points.length === 0) return false
    return contains(bounds, drawing.points[0].x, drawing.points[0].y)
  })
  titles.sort((a, b) => a.points[0].y - b.points[0].y || a.points[0].x - b.points[0].x)
  return titles[0]?.text?.trim()
}
