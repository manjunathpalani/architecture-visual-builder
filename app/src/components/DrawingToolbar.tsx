import {
  ArrowRight,
  BoxSelect,
  Circle,
  Cylinder,
  Diamond,
  Eraser,
  Hexagon,
  ImagePlus,
  Minus,
  MousePointer2,
  Pencil,
  Square,
  SquareRoundCorner,
  Triangle,
  Type,
} from 'lucide-react'
import type { DrawingShapeKind } from '../types'
import type { DrawingTool } from '../types/diagram'
import { DRAWING_COLORS } from '../utils/drawingRender'
import { FloatingToolbar } from './FloatingToolbar'

export const FREEHAND_TOOLS: { id: DrawingTool; icon: typeof Pencil; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select / move' },
  { id: 'pen', icon: Pencil, label: 'Pen' },
  { id: 'line', icon: Minus, label: 'Line' },
  { id: 'rectangle', icon: Square, label: 'Freehand rectangle' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'image', icon: ImagePlus, label: 'Image' },
  { id: 'eraser', icon: Eraser, label: 'Eraser' },
]

export const SHAPE_TOOLS: { id: DrawingTool; icon: typeof Pencil; label: string; kind: DrawingShapeKind }[] = [
  { id: 'shape-rectangle', icon: Square, label: 'Rectangle', kind: 'rectangle' },
  { id: 'shape-rounded-rect', icon: SquareRoundCorner, label: 'Rounded rect', kind: 'rounded-rect' },
  { id: 'shape-ellipse', icon: Circle, label: 'Ellipse', kind: 'ellipse' },
  { id: 'shape-diamond', icon: Diamond, label: 'Diamond', kind: 'diamond' },
  { id: 'shape-triangle', icon: Triangle, label: 'Triangle', kind: 'triangle' },
  { id: 'shape-hexagon', icon: Hexagon, label: 'Hexagon', kind: 'hexagon' },
  { id: 'shape-cylinder', icon: Cylinder, label: 'Cylinder', kind: 'cylinder' },
  { id: 'shape-parallelogram', icon: Square, label: 'Parallelogram', kind: 'parallelogram' },
]

interface DrawingToolbarProps {
  drawTool: DrawingTool
  onSelectTool: (tool: DrawingTool) => void
  drawColor: string
  onSelectColor: (color: string) => void
  onSelectAllDrawings?: () => void
  selectedDrawingCount?: number
}

export function DrawingToolbar({
  drawTool,
  onSelectTool,
  drawColor,
  onSelectColor,
  onSelectAllDrawings,
  selectedDrawingCount = 0,
}: DrawingToolbarProps) {
  return (
    <FloatingToolbar
      storageKey="avb-draw-toolbar-v1"
      className="drawing-toolbar"
      title="Draw"
      restoreLabel="Draw"
      restoreIcon={<Pencil size={14} />}
      defaultDock="top-left"
    >
      {FREEHAND_TOOLS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          className={`drawing-tool-btn ${drawTool === id ? 'active' : ''}`}
          title={label}
          onClick={() => onSelectTool(id)}
        >
          <Icon size={15} />
        </button>
      ))}
      <span className="drawing-toolbar-divider" />
      <span className="drawing-toolbar-label">Shapes</span>
      {SHAPE_TOOLS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          className={`drawing-tool-btn ${drawTool === id ? 'active' : ''}`}
          title={`${label} (resizable + connectors)`}
          onClick={() => onSelectTool(id)}
        >
          <Icon size={15} />
        </button>
      ))}
      {onSelectAllDrawings && (
        <>
          <span className="drawing-toolbar-divider" />
          <button
            type="button"
            className={`drawing-tool-btn ${selectedDrawingCount > 0 ? 'active' : ''}`}
            title="Select every drawing so you can change font and colour together"
            onClick={onSelectAllDrawings}
          >
            <BoxSelect size={15} />
          </button>
        </>
      )}
      <span className="drawing-toolbar-divider" />
      <span className="drawing-toolbar-label">Colour</span>
      <div className="drawing-color-row">
        {DRAWING_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`drawing-color-btn ${drawColor === color ? 'active' : ''}`}
            style={{ background: color }}
            title={color}
            onClick={() => onSelectColor(color)}
          />
        ))}
      </div>
    </FloatingToolbar>
  )
}
