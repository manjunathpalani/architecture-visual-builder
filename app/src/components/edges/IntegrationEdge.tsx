import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import type { EdgeFocusRelation, IntegrationEdgeData } from '../../utils/jsonIO'
import { DIRECTION_COLORS, resolveEdgeColor } from '../../utils/flowTrace'
import { CHANGE_STATUS_COLORS, parseChangeStatus } from '../../utils/architectureState'

const FOCUS_COLORS: Record<'out' | 'in', string> = {
  out: '#10b981',
  in: '#0ea5e9',
}

const DIRECTION_TEXT: Record<string, string> = {
  inbound: 'inbound',
  outbound: 'outbound',
  bidirectional: 'bidirectional',
}

const FOCUS_LABEL: Record<'out' | 'in', string> = {
  out: 'DOWNSTREAM →',
  in: '← UPSTREAM',
}

export function IntegrationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as IntegrationEdgeData | undefined
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const direction = edgeData?.direction ?? 'bidirectional'
  const label = edgeData?.label ?? 'Integration'
  const focusRelation: EdgeFocusRelation = edgeData?.focusRelation ?? 'idle'
  const isFocused = focusRelation === 'out' || focusRelation === 'in'
  const isDimmed = focusRelation === 'unrelated'
  const isActive = isFocused || selected
  const colorBy = edgeData?.colorBy ?? 'direction'

  const changeStatus = parseChangeStatus(edgeData?.changeStatus)
  const styledColor = resolveEdgeColor(edgeData, colorBy)
  const color =
    isFocused && colorBy === 'direction'
      ? FOCUS_COLORS[focusRelation]
      : isFocused && edgeData?.flowPathColor
        ? edgeData.flowPathColor
        : changeStatus !== 'unchanged'
          ? CHANGE_STATUS_COLORS[changeStatus]
          : styledColor || DIRECTION_COLORS[direction] || '#6366f1'
  const dash = changeStatus === 'new' ? '7 4' : changeStatus === 'retired' ? '3 4' : undefined

  const markerEnd =
    direction === 'outbound' ||
    direction === 'bidirectional' ||
    direction === 'inbound' ||
    isFocused
      ? `url(#arrow-end-${id})`
      : undefined
  const markerStart =
    direction === 'bidirectional' || focusRelation === 'in'
      ? `url(#arrow-start-${id})`
      : undefined

  const strokeWidth = isActive ? 3.5 : isDimmed ? 1.25 : 2.25
  const opacity = isDimmed ? 0.16 : 1

  const isBidirectional = direction === 'bidirectional'
  const showForwardParticle =
    !isDimmed && (focusRelation === 'out' || focusRelation === 'idle' || selected || isBidirectional)
  const showReverseParticle =
    !isDimmed && (focusRelation === 'in' || isBidirectional)

  return (
    <>
      <defs>
        <marker
          id={`arrow-end-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth={isActive ? 10 : 8}
          markerHeight={isActive ? 10 : 8}
          orient="auto-start-reverse"
        >
          <path d="M 1 1 L 9 5 L 1 9 Z" fill={color} />
        </marker>
        <marker
          id={`arrow-start-${id}`}
          viewBox="0 0 10 10"
          refX="1"
          refY="5"
          markerWidth={isActive ? 10 : 8}
          markerHeight={isActive ? 10 : 8}
          orient="auto"
        >
          <path d="M 9 1 L 1 5 L 9 9 Z" fill={color} />
        </marker>
        {isFocused && (
          <filter id={`glow-${id}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          stroke: color,
          strokeWidth,
          opacity: changeStatus === 'retired' ? Math.min(opacity, 0.55) : opacity,
          strokeDasharray: dash,
          filter: isFocused ? `url(#glow-${id})` : undefined,
          transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
        }}
        className={`integration-edge direction-${direction} focus-${focusRelation} change-${changeStatus} ${selected ? 'selected' : ''} ${isFocused ? 'flow-highlighted' : ''}`}
      />

      {showForwardParticle && (
        <circle
          r={isFocused ? 5 : 3.5}
          fill={color}
          className={`flow-particle ${isFocused ? 'flow-particle-active' : ''}`}
          opacity={isFocused ? 1 : 0.85}
        >
          <animateMotion
            dur={isFocused ? '1.4s' : '2.5s'}
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      )}

      {showReverseParticle && (
        <circle
          r={isFocused ? 4.5 : 3}
          fill={color}
          opacity={isFocused ? 0.95 : 0.55}
          className={`flow-particle-reverse ${isFocused ? 'flow-particle-active' : ''}`}
        >
          <animateMotion
            dur={isFocused ? '1.4s' : '2.5s'}
            repeatCount="indefinite"
            path={edgePath}
            keyPoints="1;0"
            keyTimes="0;1"
            calcMode="linear"
          />
        </circle>
      )}

      {isFocused && (
        <circle r="3" fill={color} opacity="0.55" className="flow-particle-active">
          <animateMotion
            dur="1.4s"
            begin="0.45s"
            repeatCount="indefinite"
            path={edgePath}
            keyPoints={focusRelation === 'in' ? '1;0' : '0;1'}
            keyTimes="0;1"
            calcMode="linear"
          />
        </circle>
      )}

      <EdgeLabelRenderer>
        <div
          className={`edge-label direction-${direction} focus-${focusRelation} ${selected ? 'selected' : ''} ${isFocused ? 'flow-highlighted' : ''} ${isDimmed ? 'dimmed' : ''}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            color,
            opacity: isDimmed ? 0.25 : 1,
          }}
        >
          {isFocused && (
            <span className={`edge-flow-badge flow-${focusRelation}`} style={{ background: color }}>
              {FOCUS_LABEL[focusRelation]}
            </span>
          )}
          <span className="edge-label-text">{label}</span>
          <span className="edge-direction">
            {isFocused
              ? focusRelation === 'out'
                ? 'toward end systems'
                : 'from start systems'
              : (DIRECTION_TEXT[direction] ?? direction)}
          </span>
          {changeStatus !== 'unchanged' && !isDimmed && (
            <span className={`edge-change-flag change-${changeStatus}`}>
              {changeStatus === 'new' ? 'future' : changeStatus === 'modified' ? 'changed' : 'retired'}
            </span>
          )}
          {edgeData?.protocol && !isDimmed && (
            <span className="edge-protocol">{edgeData.protocol}</span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
