import { getSmoothStepPath, type ConnectionLineComponentProps } from '@xyflow/react'

/** Preview line while dragging A → B; rounded orthogonal, arrow points at the drop target. */
export function IntegrationConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
}: ConnectionLineComponentProps) {
  const [path] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
    borderRadius: 16,
  })
  return (
    <g>
      <defs>
        <marker
          id="avb-connection-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          markerUnits="strokeWidth"
          orient="auto"
        >
          <path d="M 1 1 L 9 5 L 1 9 Z" fill="#6366f1" />
        </marker>
      </defs>
      <path
        fill="none"
        stroke="#6366f1"
        strokeWidth={2}
        d={path}
        markerEnd="url(#avb-connection-arrow)"
      />
    </g>
  )
}
