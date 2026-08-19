import type { Integration, SystemNode } from '../types'

export type FreehandDrawingTool =
  | 'select'
  | 'pen'
  | 'line'
  | 'rectangle'
  | 'arrow'
  | 'text'
  | 'eraser'

/** Shape tools place resizable, connectable shape nodes on the canvas */
export type ShapeDrawingTool =
  | 'shape-rectangle'
  | 'shape-rounded-rect'
  | 'shape-ellipse'
  | 'shape-diamond'
  | 'shape-triangle'
  | 'shape-hexagon'
  | 'shape-cylinder'
  | 'shape-parallelogram'

export type DrawingTool = FreehandDrawingTool | ShapeDrawingTool

export function isShapeDrawingTool(tool: DrawingTool): tool is ShapeDrawingTool {
  return tool.startsWith('shape-')
}

export function shapeKindFromTool(
  tool: ShapeDrawingTool,
):
  | 'rectangle'
  | 'rounded-rect'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'hexagon'
  | 'cylinder'
  | 'parallelogram' {
  return tool.replace(/^shape-/, '') as
    | 'rectangle'
    | 'rounded-rect'
    | 'ellipse'
    | 'diamond'
    | 'triangle'
    | 'hexagon'
    | 'cylinder'
    | 'parallelogram'
}

export type DrawingElementType = 'path' | 'line' | 'rectangle' | 'arrow' | 'text'

export interface DrawingPoint {
  x: number
  y: number
}

export interface DrawingElement {
  id: string
  type: DrawingElementType
  points: DrawingPoint[]
  color: string
  strokeWidth: number
  fill?: string
  text?: string
  fontSize?: number
}

export interface SubDiagram {
  name?: string
  description?: string
  systems: SystemNode[]
  integrations: Integration[]
  drawings?: DrawingElement[]
}

export interface DiagramPathSegment {
  systemId: string
  label: string
}

export type DiagramPath = DiagramPathSegment[]

export interface DiagramView {
  systems: SystemNode[]
  integrations: Integration[]
  drawings: DrawingElement[]
  level: 'root' | 'sub'
  parentPath: DiagramPath
  parentLabel?: string
}