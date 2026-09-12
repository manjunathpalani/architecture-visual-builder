import { NodeResizer, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import type { DrawingShapeKind } from '../../types'
import { DRAWING_SHAPE_LABELS } from '../../types'
import type { IntegrationNodeData } from '../../utils/jsonIO'
import { NodeConnectors } from './NodeConnectors'
import { withNodeFontSize } from '../../utils/nodeFontSize'
import { useDiagramLock } from './diagramLockContext'
import { useNodeTitleEdit } from './nodeTitleEditContext'

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

export function ShapeNode({ id, data, selected }: NodeProps) {
  const layoutLocked = useDiagramLock()
  const { editingNodeId, startEditing, finishEditing, cancelEditing } = useNodeTitleEdit()
  const nodeData = data as IntegrationNodeData
  const kind = shapeKind(nodeData)
  const color = nodeData.properties.color ?? '#64748b'
  const fill = nodeData.properties.fill ?? `${color}22`
  const label = nodeData.label ?? ''
  const editing = editingNodeId === id
  const [draft, setDraft] = useState(label)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const openedAtRef = useRef(0)

  useEffect(() => {
    if (!editing) return
    setDraft(label)
    openedAtRef.current = Date.now()
    window.requestAnimationFrame(() => {
      textRef.current?.focus()
      textRef.current?.select()
    })
  }, [editing, label])

  const commit = () => {
    if (Date.now() - openedAtRef.current < 250) {
      textRef.current?.focus()
      return
    }
    finishEditing(id, draft.trim())
  }

  return (
    <>
      <NodeResizer
        minWidth={48}
        minHeight={36}
        isVisible={selected && !layoutLocked}
        lineClassName="resize-line"
        handleClassName="resize-handle"
      />

      {selected && !editing && !layoutLocked && (
        <NodeToolbar isVisible position={Position.Bottom} offset={10} className="shape-text-toolbar nodrag nopan">
          <button
            type="button"
            className="shape-text-btn"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation()
              startEditing(id)
            }}
          >
            {label ? 'Edit text' : 'Add text'}
          </button>
        </NodeToolbar>
      )}

      <NodeConnectors variant="shape" />

      <div
        className={`shape-node resizable-node ${selected ? 'selected' : ''} ${nodeData.isFlowFocus ? 'flow-focus' : ''} ${nodeData.isFlowNeighbor ? 'flow-neighbor' : ''} ${nodeData.isFlowPath ? 'flow-path' : ''} ${nodeData.isFlowPlayCurrent ? 'flow-play-current' : ''} ${nodeData.showTouchPoints ? 'show-touch-points' : ''}`}
        style={withNodeFontSize(nodeData.properties)}
        title={label ? 'Double-click to edit text' : 'Double-click to add text'}
        onDoubleClick={(event) => {
          event.stopPropagation()
          if (!layoutLocked) startEditing(id)
        }}
      >
        <svg className="shape-node-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <ShapeGeometry kind={kind} color={color} fill={fill} selected={!!selected} />
        </svg>
        {editing ? (
          <textarea
            ref={textRef}
            className="shape-node-text-editor nodrag nopan nowheel"
            value={draft}
            placeholder={`Add text (${DRAWING_SHAPE_LABELS[kind]})`}
            aria-label="Shape text"
            onChange={(event) => setDraft(event.target.value)}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelEditing()
              }
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()
                commit()
              }
            }}
          />
        ) : (
          <div className={`shape-node-label ${label ? '' : 'is-placeholder'}`}>
            {label || (selected ? 'Add text' : '')}
          </div>
        )}
      </div>
    </>
  )
}
