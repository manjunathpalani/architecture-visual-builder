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
}): { path: string; labelX: number; labelY: number; points: Point[] } {
  const routing = parseEdgeRouting(params.routing)
  const start = point(params.sourceX, params.sourceY)
  const end = point(params.targetX, params.targetY)
  const waypoints = (params.waypoints ?? []).filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
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
