import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import type { DrawingShapeKind } from '../../types'
import { DRAWING_SHAPE_LABELS } from '../../types'
import type { IntegrationNodeData } from '../../utils/jsonIO'

function shapeKind(data: IntegrationNodeData): DrawingShapeKind {
  const raw = data.properties.shape as DrawingShapeKind | undefined
  return raw && raw in DRAWING_SHAPE_LABELS ? raw : 'rectangle'
}

function ShapeGeometry({
  kind,
  color,
  fill,
  selected,
}: {
  kind: DrawingShapeKind
  color: string
  fill: string
  selected: boolean
}) {
  const stroke = selected ? '#6366f1' : color
  const strokeWidth = selected ? 2.5 : 2

  switch (kind) {
    case 'ellipse':
      return (
        <ellipse
          cx="50"
          cy="50"
          rx="46"
          ry="44"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )
    case 'diamond':
      return (
        <polygon
          points="50,4 96,50 50,96 4,50"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )
    case 'triangle':
      return (
        <polygon
          points="50,6 94,94 6,94"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )
    case 'hexagon':
      return (
        <polygon
          points="25,6 75,6 96,50 75,94 25,94 4,50"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )
    case 'parallelogram':
      return (
        <polygon
          points="18,8 96,8 82,92 4,92"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )
    case 'cylinder':
      return (
        <g>
          <path
            d="M 8 22 L 8 78 Q 8 94 50 94 Q 92 94 92 78 L 92 22"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="50"
            cy="22"
            rx="42"
            ry="14"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )
    case 'rounded-rect':
      return (
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="14"
          ry="14"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )
    case 'rectangle':
    default:
      return (
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="2"
          ry="2"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      )
  }
}

export function ShapeNode({ data, selected }: NodeProps) {
  const nodeData = data as IntegrationNodeData
  const kind = shapeKind(nodeData)
  const color = nodeData.properties.color ?? '#64748b'
  const fill = nodeData.properties.fill ?? `${color}22`
  const label = nodeData.label || DRAWING_SHAPE_LABELS[kind]

  return (
    <>
      <NodeResizer
        minWidth={60}
        minHeight={48}
        isVisible={selected}
        lineClassName="resize-line"
        handleClassName="resize-handle"
      />

      <Handle type="target" position={Position.Top} id="t-top" className="shape-handle" />
      <Handle type="source" position={Position.Top} id="s-top" className="shape-handle shape-handle-source" />
      <Handle type="target" position={Position.Right} id="t-right" className="shape-handle" />
      <Handle type="source" position={Position.Right} id="s-right" className="shape-handle shape-handle-source" />
      <Handle type="target" position={Position.Bottom} id="t-bottom" className="shape-handle" />
      <Handle type="source" position={Position.Bottom} id="s-bottom" className="shape-handle shape-handle-source" />
      <Handle type="target" position={Position.Left} id="t-left" className="shape-handle" />
      <Handle type="source" position={Position.Left} id="s-left" className="shape-handle shape-handle-source" />

      <div
        className={`shape-node resizable-node ${selected ? 'selected' : ''} ${nodeData.isFlowFocus ? 'flow-focus' : ''} ${nodeData.isFlowNeighbor ? 'flow-neighbor' : ''} ${nodeData.isFlowPath ? 'flow-path' : ''}`}
      >
        <svg className="shape-node-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <ShapeGeometry kind={kind} color={color} fill={fill} selected={!!selected} />
        </svg>
        <div className="shape-node-label">{label}</div>
      </div>
    </>
  )
}
