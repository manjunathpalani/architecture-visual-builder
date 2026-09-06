import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react'
import { useEffect, useRef } from 'react'
import type { Position } from '../../types'
import type { EdgeFocusRelation, IntegrationEdgeData } from '../../utils/jsonIO'
import { DIRECTION_COLORS, resolveEdgeColor } from '../../utils/flowTrace'
import { CHANGE_STATUS_COLORS, parseChangeStatus } from '../../utils/architectureState'
import { buildEdgePath, segmentMidpoints } from '../../utils/edgeRouting'
import { useEdgeEdit } from './edgeEdit'

const FOCUS_COLORS: Record<'out' | 'in', string> = {
  out: '#10b981',
  in: '#0ea5e9',
}

const DIRECTION_TEXT: Record<string, string> = {
  inbound: '← to source',
  outbound: '→ to target',
  bidirectional: '↔ both ways',
  none: 'no arrow',
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
  const { screenToFlowPosition } = useReactFlow()
  const { updateEdgeGeometry } = useEdgeEdit()
  const dragRef = useRef<{ index: number; points: Position[] } | null>(null)
  const geometryRef = useRef({ id, updateEdgeGeometry, screenToFlowPosition })
  geometryRef.current = { id, updateEdgeGeometry, screenToFlowPosition }

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const { screenToFlowPosition: toFlow, id: edgeId, updateEdgeGeometry: update } = geometryRef.current
      const point = toFlow({ x: event.clientX, y: event.clientY })
      const next = drag.points.map((p, i) => (i === drag.index ? point : p))
      update(edgeId, { waypoints: next })
      dragRef.current = { ...drag, points: next }
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const waypoints = edgeData?.waypoints ?? []
  const { path: edgePath, labelX, labelY, points } = buildEdgePath({
    routing: edgeData?.routing,
    waypoints,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const direction = edgeData?.direction ?? 'outbound'
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

  const showEndArrow = direction === 'outbound' || direction === 'bidirectional'
  const showStartArrow = direction === 'inbound' || direction === 'bidirectional'
  const markerEnd = showEndArrow ? `url(#arrow-end-${id})` : undefined
  const markerStart = showStartArrow ? `url(#arrow-start-${id})` : undefined

  const strokeWidth = isActive ? 3.5 : isDimmed ? 1.25 : 2.75
  const opacity = isDimmed ? 0.16 : 0.92

  const isBidirectional = direction === 'bidirectional'
  const showForwardParticle =
    !isDimmed &&
    direction !== 'none' &&
    (direction === 'outbound' || isBidirectional || focusRelation === 'out')
  const showReverseParticle =
    !isDimmed &&
    direction !== 'none' &&
    (direction === 'inbound' || isBidirectional || focusRelation === 'in')

  const beginWaypointDrag = (event: React.PointerEvent, index: number, nextPoints: Position[]) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = { index, points: nextPoints }
  }

  const addWaypointAt = (event: React.PointerEvent, insertAt: number, seed: Position) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const next = [...waypoints]
    next.splice(insertAt, 0, seed)
    updateEdgeGeometry(id, { waypoints: next })
    dragRef.current = { index: insertAt, points: next }
  }

  const removeWaypoint = (event: React.MouseEvent, index: number) => {
    event.preventDefault()
    event.stopPropagation()
    updateEdgeGeometry(id, { waypoints: waypoints.filter((_, i) => i !== index) })
  }

  const mids = selected ? segmentMidpoints(points) : []

  return (
    <>
      <defs>
        <marker
          id={`arrow-end-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth={isActive ? 14 : 13}
          markerHeight={isActive ? 14 : 13}
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M 1 1 L 9 5 L 1 9 Z" fill={color} />
        </marker>
        <marker
          id={`arrow-start-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth={isActive ? 14 : 13}
          markerHeight={isActive ? 14 : 13}
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path d="M 1 1 L 9 5 L 1 9 Z" fill={color} />
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
        interactionWidth={24}
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
          r={isFocused ? 5 : 4}
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
        {isActive && (
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
          {selected && (
            <button
              type="button"
              className="edge-arrow-flip nodrag nopan"
              title="Change arrow direction"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                const order = ['outbound', 'inbound', 'bidirectional', 'none'] as const
                const index = order.indexOf(direction as (typeof order)[number])
                const next = order[(index + 1) % order.length]
                updateEdgeGeometry(id, { direction: next })
              }}
            >
              {direction === 'inbound'
                ? '← Flip arrow'
                : direction === 'bidirectional'
                  ? '↔ Flip arrow'
                  : direction === 'none'
                    ? '— Flip arrow'
                    : '→ Flip arrow'}
            </button>
          )}
          {changeStatus !== 'unchanged' && !isDimmed && (
            <span className={`edge-change-flag change-${changeStatus}`}>
              {changeStatus === 'new' ? 'future' : changeStatus === 'modified' ? 'changed' : 'retired'}
            </span>
          )}
          {edgeData?.protocol && !isDimmed && (
            <span className="edge-protocol">{edgeData.protocol}</span>
          )}
        </div>
        )}

        {selected &&
          waypoints.map((wp, index) => (
            <div
              key={`wp-${index}`}
              className="edge-waypoint nodrag nopan"
              title="Drag to bend · double-click to remove"
              style={{
                transform: `translate(-50%, -50%) translate(${wp.x}px, ${wp.y}px)`,
                background: color,
              }}
              onPointerDown={(event) => beginWaypointDrag(event, index, waypoints)}
              onDoubleClick={(event) => removeWaypoint(event, index)}
            />
          ))}

        {selected &&
          mids.map((mid, index) => (
            <div
              key={`mid-${index}`}
              className="edge-waypoint-add nodrag nopan"
              title="Drag to add a bend"
              style={{
                transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
              }}
              onPointerDown={(event) => addWaypointAt(event, index, mid)}
            />
          ))}
      </EdgeLabelRenderer>
    </>
  )
}
