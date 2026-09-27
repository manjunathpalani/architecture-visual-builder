import { getBezierPath, getSmoothStepPath, getStraightPath, Position } from '@xyflow/react'
import { parseEdgeRouting, type Position as Point } from '../types'

export { parseEdgeRouting }

export function defaultWaypoints(): Point[] {
  return []
}

function point(x: number, y: number): Point {
  return { x, y }
}

export function labelAnchor(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]
  const mid = (points.length - 1) / 2
  const i = Math.floor(mid)
  if (i === mid) return points[i]
  return {
    x: (points[i].x + points[i + 1].x) / 2,
    y: (points[i].y + points[i + 1].y) / 2,
  }
}

function polyline(points: Point[]): string {
  if (points.length === 0) return ''
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')
}

function orthogonalPoints(points: Point[], startVertical: boolean): Point[] {
  if (points.length < 2) return points
  const out: Point[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1]
    const next = points[i]
    if (prev.x === next.x || prev.y === next.y) {
      out.push(next)
      continue
    }
    const verticalFirst = i === 1 ? startVertical : prev.x === out[out.length - 2]?.x
    if (verticalFirst) {
      out.push(point(prev.x, next.y))
    } else {
      out.push(point(next.x, prev.y))
    }
    out.push(next)
  }
  return out
}

function roundedOrthogonalPath(points: Point[], radius = 12): string {
  if (points.length < 2) return polyline(points)
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]
    const dx1 = curr.x - prev.x
    const dy1 = curr.y - prev.y
    const dx2 = next.x - curr.x
    const dy2 = next.y - curr.y
    const len1 = Math.hypot(dx1, dy1) || 1
    const len2 = Math.hypot(dx2, dy2) || 1
    const r = Math.min(radius, len1 / 2, len2 / 2)
    const start = point(curr.x - (dx1 / len1) * r, curr.y - (dy1 / len1) * r)
    const end = point(curr.x + (dx2 / len2) * r, curr.y + (dy2 / len2) * r)
    d += ` L ${start.x} ${start.y} Q ${curr.x} ${curr.y} ${end.x} ${end.y}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

function curvedThrough(points: Point[]): string {
  if (points.length < 2) return polyline(points)
  if (points.length === 2) {
    const [a, b] = points
    const mx = (a.x + b.x) / 2
    return `M ${a.x} ${a.y} C ${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`
  }
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const mx = (a.x + b.x) / 2
    d += ` C ${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`
  }
  return d
}

export function buildEdgePath(params: {
  routing?: string
  waypoints?: Point[]
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  /** Perpendicular shift when another connector already uses this same path. */
  routeOffset?: number
}): { path: string; labelX: number; labelY: number; points: Point[] } {
  const routing = parseEdgeRouting(params.routing)
  const start = point(params.sourceX, params.sourceY)
  const end = point(params.targetX, params.targetY)
  const waypoints = shiftOverlappingRoute(
    start,
    (params.waypoints ?? []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    end,
    params.routeOffset ?? 0,
  )
  const points = [start, ...waypoints, end]
  const startVertical =
    params.sourcePosition === Position.Top || params.sourcePosition === Position.Bottom

  if (waypoints.length > 0) {
    if (routing === 'straight') {
      const anchor = labelAnchor(points)
      return { path: polyline(points), labelX: anchor.x, labelY: anchor.y, points }
    }
    if (routing === 'step') {
      const ortho = orthogonalPoints(points, startVertical)
      const anchor = labelAnchor(ortho)
      return { path: polyline(ortho), labelX: anchor.x, labelY: anchor.y, points }
    }
    if (routing === 'smoothstep') {
      const ortho = orthogonalPoints(points, startVertical)
      const anchor = labelAnchor(ortho)
      return { path: roundedOrthogonalPath(ortho), labelX: anchor.x, labelY: anchor.y, points }
    }
    const anchor = labelAnchor(points)
    return { path: curvedThrough(points), labelX: anchor.x, labelY: anchor.y, points }
  }

  if (routing === 'straight') {
    const [path, labelX, labelY] = getStraightPath({
      sourceX: params.sourceX,
      sourceY: params.sourceY,
      targetX: params.targetX,
      targetY: params.targetY,
    })
    return { path, labelX, labelY, points }
  }

  if (routing === 'step' || routing === 'smoothstep') {
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX: params.sourceX,
      sourceY: params.sourceY,
      sourcePosition: params.sourcePosition,
      targetX: params.targetX,
      targetY: params.targetY,
      targetPosition: params.targetPosition,
      borderRadius: routing === 'step' ? 0 : 16,
    })
    return { path, labelX, labelY, points }
  }

  const [path, labelX, labelY] = getBezierPath({
    sourceX: params.sourceX,
    sourceY: params.sourceY,
    sourcePosition: params.sourcePosition,
    targetX: params.targetX,
    targetY: params.targetY,
    targetPosition: params.targetPosition,
  })
  return { path, labelX, labelY, points }
}

export function segmentMidpoints(points: Point[]): Point[] {
  const mids: Point[] = []
  for (let i = 0; i < points.length - 1; i++) {
    mids.push({
      x: (points[i].x + points[i + 1].x) / 2,
      y: (points[i].y + points[i + 1].y) / 2,
    })
  }
  return mids
}

/** Push a shared route sideways so connectors that start and end together do not draw on top of each other. */
function shiftOverlappingRoute(start: Point, waypoints: Point[], end: Point, offset: number): Point[] {
  if (!offset) return waypoints
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  if (waypoints.length === 0) {
    return [point((start.x + end.x) / 2 + nx * offset, (start.y + end.y) / 2 + ny * offset)]
  }
  return waypoints.map((p) => point(p.x + nx * offset, p.y + ny * offset))
}

export type ConnectorSide = 'top' | 'right' | 'bottom' | 'left'
export type ConnectorSlot = 'start' | 'center' | 'end'

const CONNECTOR_SLOTS: ConnectorSlot[] = ['center', 'start', 'end']

export interface FanEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export interface FanNode {
  id: string
  position: { x: number; y: number }
  parentId?: string
  measured?: { width?: number; height?: number }
  style?: { width?: unknown; height?: unknown }
}

export function connectorHandleId(kind: 's' | 't', side: ConnectorSide, slot: ConnectorSlot): string {
  return slot === 'center' ? `${kind}-${side}` : `${kind}-${side}-${slot}`
}

/**
 * When several integrations attach on the same side of a component, give each a
 * different connector (start / center / end) so the lines do not share a point.
 */
export function fanSharedConnectors<T extends FanEdge>(edges: T[], nodes: FanNode[]): T[] {
  const centers = nodeCenters(nodes)
  const next = edges.map((edge) => ({ ...edge }))
  const sourceSide = new Map<string, ConnectorSide>()
  const targetSide = new Map<string, ConnectorSide>()

  for (const edge of next) {
    const from = centers.get(edge.source)
    const to = centers.get(edge.target)
    sourceSide.set(edge.id, (parseConnectorHandle(edge.sourceHandle) ?? defaultSource(from, to)).side)
    targetSide.set(edge.id, (parseConnectorHandle(edge.targetHandle) ?? defaultTarget(from, to)).side)
  }

  assignFreeSlots(next, sourceSide, targetSide)
  return next
}

/** Pixel offset for the nth connector that still shares a handle after fanning. */
export function sharedRouteOffset(index: number, count: number, gap = 22): number {
  if (count <= 1 || index < 0) return 0
  return (index - (count - 1) / 2) * gap
}

function assignFreeSlots<T extends FanEdge>(
  edges: T[],
  sourceSide: Map<string, ConnectorSide>,
  targetSide: Map<string, ConnectorSide>,
) {
  const groups = new Map<string, Array<{ edge: T; role: 'source' | 'target'; side: ConnectorSide }>>()
  for (const edge of edges) {
    const source = sourceSide.get(edge.id)
    const target = targetSide.get(edge.id)
    if (source) {
      const key = `${edge.source}|${source}`
      const list = groups.get(key) ?? []
      list.push({ edge, role: 'source', side: source })
      groups.set(key, list)
    }
    if (target) {
      const key = `${edge.target}|${target}`
      const list = groups.get(key) ?? []
      list.push({ edge, role: 'target', side: target })
      groups.set(key, list)
    }
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue
    const explicit = (touch: (typeof group)[number]) => {
      const handle = touch.role === 'source' ? touch.edge.sourceHandle : touch.edge.targetHandle
      return parseConnectorHandle(handle)?.side === touch.side ? 0 : 1
    }
    const ordered = [...group].sort(
      (a, b) => explicit(a) - explicit(b) || a.edge.id.localeCompare(b.edge.id) || a.role.localeCompare(b.role),
    )
    const used = new Set<ConnectorSlot>()
    const placed: typeof ordered = []
    for (const touch of ordered) {
      const handle = touch.role === 'source' ? touch.edge.sourceHandle : touch.edge.targetHandle
      const parsed = parseConnectorHandle(handle)
      const slot = parsed?.side === touch.side ? parsed.slot : 'center'
      if (handle && parsed?.side === touch.side && !used.has(slot)) {
        used.add(slot)
        placed.push(touch)
        continue
      }
      const free = CONNECTOR_SLOTS.find((item) => !used.has(item)) ?? CONNECTOR_SLOTS[placed.length % CONNECTOR_SLOTS.length]
      used.add(free)
      const id = connectorHandleId(touch.role === 'source' ? 's' : 't', touch.side, free)
      if (touch.role === 'source') touch.edge.sourceHandle = id
      else touch.edge.targetHandle = id
      placed.push(touch)
    }
  }
}

function defaultSource(
  from: { x: number; y: number } | undefined,
  to: { x: number; y: number } | undefined,
): { side: ConnectorSide; slot: ConnectorSlot } {
  if (!from || !to || (from.x === to.x && from.y === to.y)) return { side: 'right', slot: 'center' }
  return { side: sideFromDelta(to.x - from.x, to.y - from.y), slot: 'center' }
}

function defaultTarget(
  from: { x: number; y: number } | undefined,
  to: { x: number; y: number } | undefined,
): { side: ConnectorSide; slot: ConnectorSlot } {
  if (!from || !to || (from.x === to.x && from.y === to.y)) return { side: 'left', slot: 'center' }
  return { side: oppositeSide(sideFromDelta(to.x - from.x, to.y - from.y)), slot: 'center' }
}

function sideFromDelta(dx: number, dy: number): ConnectorSide {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

function oppositeSide(side: ConnectorSide): ConnectorSide {
  if (side === 'left') return 'right'
  if (side === 'right') return 'left'
  if (side === 'top') return 'bottom'
  return 'top'
}

export function parseConnectorHandle(
  handle?: string | null,
): { kind: 's' | 't'; side: ConnectorSide; slot: ConnectorSlot } | null {
  if (!handle) return null
  const match = /^(s|t)-(top|right|bottom|left)(?:-(start|center|end))?$/.exec(handle)
  if (!match) return null
  return {
    kind: match[1] as 's' | 't',
    side: match[2] as ConnectorSide,
    slot: (match[3] as ConnectorSlot | undefined) ?? 'center',
  }
}

function nodeCenters(nodes: FanNode[]): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const centers = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    let x = node.position.x
    let y = node.position.y
    let parentId = node.parentId
    const seen = new Set<string>()
    while (parentId && byId.has(parentId) && !seen.has(parentId)) {
      seen.add(parentId)
      const parent = byId.get(parentId)!
      x += parent.position.x
      y += parent.position.y
      parentId = parent.parentId
    }
    const width = Number(node.measured?.width ?? node.style?.width ?? 180)
    const height = Number(node.measured?.height ?? node.style?.height ?? 90)
    centers.set(node.id, {
      x: x + (Number.isFinite(width) && width > 0 ? width : 180) / 2,
      y: y + (Number.isFinite(height) && height > 0 ? height : 90) / 2,
    })
  }
  return centers
}

function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Index in `waypoints` at which to insert a bend for the closest segment. */
export function nearestWaypointInsertIndex(points: Point[], p: Point): number {
  if (points.length < 2) return 0
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const dist = distanceToSegment(p, points[i], points[i + 1])
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

let measurePath: SVGPathElement | null = null

function getMeasurePath() {
  if (typeof document === 'undefined') return null
  if (!measurePath) measurePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  return measurePath
}

export function pointAlongPath(d: string, t: number): Point | null {
  const el = getMeasurePath()
  if (!el || !d) return null
  el.setAttribute('d', d)
  const len = el.getTotalLength()
  if (!Number.isFinite(len) || len <= 0) return null
  const p = el.getPointAtLength(Math.max(0, Math.min(1, t)) * len)
  return { x: p.x, y: p.y }
}
