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