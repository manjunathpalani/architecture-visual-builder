import type { CSSProperties } from 'react'
import type { DrawingElement, DrawingPoint } from '../types/diagram'
import { NODE_FONT_FAMILIES } from './nodeFontSize'

export const DRAWING_COLORS = [
  '#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#334155', '#0078d4',
]

export function drawingFontCss(element: Pick<DrawingElement, 'fontFamily' | 'fontWeight' | 'fontStyle' | 'fontSize'>): CSSProperties {
  const family = NODE_FONT_FAMILIES.find((font) => font.id === (element.fontFamily ?? 'default'))
  return {
    fontFamily: family?.css ?? 'inherit',
    fontWeight: element.fontWeight ?? '600',
    fontStyle: element.fontStyle === 'italic' ? 'italic' : 'normal',
    fontSize: element.fontSize ?? 14,
  }
}

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

/** Even-odd frame path so rectangle interiors let clicks through to nodes and edges. */
export function rectFramePath(rect: DrawnRect, thickness: number): string {
  const { x, y, width, height } = rect
  const t = Math.max(1, Math.min(thickness, width / 2, height / 2))
  const innerW = width - t * 2
  const innerH = height - t * 2
  if (innerW <= 1 || innerH <= 1) {
    return `M ${x} ${y} h ${width} v ${height} h ${-width} z`
  }
  return `M ${x} ${y} h ${width} v ${height} h ${-width} z M ${x + t} ${y + t} v ${innerH} h ${innerW} v ${-innerH} z`
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
      if (element.points.length < 2) {
        return element.points.some(
          (p) => Math.hypot(p.x - point.x, p.y - point.y) <= tolerance,
        )
      }
      for (let i = 1; i < element.points.length; i++) {
        if (distanceToSegment(point, element.points[i - 1], element.points[i]) <= tolerance) {
          return true
        }
      }
      return false
    }
    case 'line':
    case 'arrow': {
      if (element.points.length < 2) return false
      const [a, b] = element.points
      const dist = distanceToSegment(point, a, b)
      return dist <= tolerance
    }
    case 'rectangle':
    case 'image': {
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

/** True when the point is on the rectangle border, not the interior. */
export function hitTestRectBorder(
  element: DrawingElement,
  point: DrawingPoint,
  thickness = 12,
): boolean {
  if (element.type !== 'rectangle' && element.type !== 'image') return false
  if (element.points.length < 2) return false
  const { x, y, width, height } = rectFromPoints(element.points[0], element.points[1])
  const t = Math.max(1, thickness)
  const insideOuter =
    point.x >= x - t &&
    point.x <= x + width + t &&
    point.y >= y - t &&
    point.y <= y + height + t
  const insideInner =
    point.x >= x + t &&
    point.x <= x + width - t &&
    point.y >= y + t &&
    point.y <= y + height - t
  return insideOuter && !insideInner
}

export function drawingBounds(
  element: DrawingElement,
): { x: number; y: number; width: number; height: number } | null {
  if ((element.type === 'rectangle' || element.type === 'image') && element.points.length >= 2) {
    return rectFromPoints(element.points[0], element.points[1])
  }
  if (element.points.length === 0) return null
  if (element.type === 'text') {
    const anchor = element.points[0]
    const w = Math.max(24, (element.text?.length ?? 4) * (element.fontSize ?? 14) * 0.55)
    const h = element.fontSize ?? 14
    return { x: anchor.x, y: anchor.y - h, width: w, height: h }
  }
  const xs = element.points.map((point) => point.x)
  const ys = element.points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
  }
}

export function boxesIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
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