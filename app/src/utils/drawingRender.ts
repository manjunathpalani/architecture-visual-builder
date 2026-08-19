import type { DrawingElement, DrawingPoint } from '../types/diagram'

export const DRAWING_COLORS = [
  '#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#334155', '#0078d4',
]

export function rectFromPoints(a: DrawingPoint, b: DrawingPoint) {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const width = Math.abs(b.x - a.x)
  const height = Math.abs(b.y - a.y)
  return { x, y, width, height }
}

export type RectHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface DrawnRect {
  x: number
  y: number
  width: number
  height: number
}

export const RECT_HANDLES: Array<{ id: RectHandle; cursor: string }> = [
  { id: 'nw', cursor: 'nwse-resize' },
  { id: 'n', cursor: 'ns-resize' },
  { id: 'ne', cursor: 'nesw-resize' },
  { id: 'e', cursor: 'ew-resize' },
  { id: 'se', cursor: 'nwse-resize' },
  { id: 's', cursor: 'ns-resize' },
  { id: 'sw', cursor: 'nesw-resize' },
  { id: 'w', cursor: 'ew-resize' },
]

export function rectHandlePosition(rect: DrawnRect, handle: RectHandle): DrawingPoint {
  const midX = rect.x + rect.width / 2
  const midY = rect.y + rect.height / 2
  const right = rect.x + rect.width
  const bottom = rect.y + rect.height
  switch (handle) {
    case 'nw':
      return { x: rect.x, y: rect.y }
    case 'n':
      return { x: midX, y: rect.y }
    case 'ne':
      return { x: right, y: rect.y }
    case 'e':
      return { x: right, y: midY }
    case 'se':
      return { x: right, y: bottom }
    case 's':
      return { x: midX, y: bottom }
    case 'sw':
      return { x: rect.x, y: bottom }
    case 'w':
      return { x: rect.x, y: midY }
  }
}

export function resizeRectFromHandle(
  start: DrawnRect,
  handle: RectHandle,
  point: DrawingPoint,
  minSize = 8,
): DrawnRect {
  let left = start.x
  let top = start.y
  let right = start.x + start.width
  let bottom = start.y + start.height

  if (handle.includes('w')) left = point.x
  if (handle.includes('e')) right = point.x
  if (handle.includes('n')) top = point.y
  if (handle.includes('s')) bottom = point.y

  if (right < left) {
    const swap = left
    left = right
    right = swap
  }
  if (bottom < top) {
    const swap = top
    top = bottom
    bottom = swap
  }

  if (right - left < minSize) {
    if (handle.includes('w')) left = right - minSize
    else right = left + minSize
  }
  if (bottom - top < minSize) {
    if (handle.includes('n')) top = bottom - minSize
    else bottom = top + minSize
  }

  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function rectToCornerPoints(rect: DrawnRect): [DrawingPoint, DrawingPoint] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ]
}

export function hitTestRectHandle(
  rect: DrawnRect,
  point: DrawingPoint,
  handleSize: number,
): RectHandle | null {
  const hit = handleSize
  for (const { id } of RECT_HANDLES) {
    const pos = rectHandlePosition(rect, id)
    if (Math.abs(point.x - pos.x) <= hit && Math.abs(point.y - pos.y) <= hit) {
      return id
    }
  }
  return null
}

export function pathToSvg(points: DrawingPoint[]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')}`
}

export function arrowHead(
  from: DrawingPoint,
  to: DrawingPoint,
  size = 10,
): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const x1 = to.x - size * Math.cos(angle - Math.PI / 6)
  const y1 = to.y - size * Math.sin(angle - Math.PI / 6)
  const x2 = to.x - size * Math.cos(angle + Math.PI / 6)
  const y2 = to.y - size * Math.sin(angle + Math.PI / 6)
  return `${to.x},${to.y} ${x1},${y1} ${x2},${y2}`
}

export function hitTestDrawing(
  element: DrawingElement,
  point: DrawingPoint,
  tolerance = 8,
): boolean {
  switch (element.type) {
    case 'path': {
      return element.points.some(
        (p) => Math.hypot(p.x - point.x, p.y - point.y) <= tolerance,
      )
    }
    case 'line':
    case 'arrow': {
      if (element.points.length < 2) return false
      const [a, b] = element.points
      const dist = distanceToSegment(point, a, b)
      return dist <= tolerance
    }
    case 'rectangle': {
      if (element.points.length < 2) return false
      const { x, y, width, height } = rectFromPoints(
        element.points[0],
        element.points[1],
      )
      return (
        point.x >= x - tolerance &&
        point.x <= x + width + tolerance &&
        point.y >= y - tolerance &&
        point.y <= y + height + tolerance
      )
    }
    case 'text': {
      const anchor = element.points[0]
      if (!anchor) return false
      const w = (element.text?.length ?? 4) * (element.fontSize ?? 14) * 0.55
      const h = element.fontSize ?? 14
      return (
        point.x >= anchor.x - tolerance &&
        point.x <= anchor.x + w + tolerance &&
        point.y >= anchor.y - h - tolerance &&
        point.y <= anchor.y + tolerance
      )
    }
    default:
      return false
  }
}

function distanceToSegment(p: DrawingPoint, a: DrawingPoint, b: DrawingPoint) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  return Math.hypot(p.x - projX, p.y - projY)
}