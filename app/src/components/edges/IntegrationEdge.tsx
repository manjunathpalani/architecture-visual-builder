import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  useStore,
  useStoreApi,
  type EdgeProps,
} from '@xyflow/react'
import { useEffect, useRef } from 'react'
import { Layers } from 'lucide-react'
import { parseLineAnimation, parseLineStyle, parseLineWeight, type Position } from '../../types'
import type { EdgeFocusRelation, IntegrationEdgeData } from '../../utils/jsonIO'
import { DIRECTION_COLORS, resolveEdgeColor } from '../../utils/flowTrace'
import { CHANGE_STATUS_COLORS, parseChangeStatus } from '../../utils/architectureState'
import { buildEdgePath, nearestWaypointInsertIndex, pointAlongPath, sharedRouteOffset } from '../../utils/edgeRouting'
import { useEdgeEdit } from './edgeEdit'
import { useDiagramLock } from '../nodes/diagramLockContext'
import { useDrillIn, useSequenceHop } from '../nodes/drillInContext'
import { NotesBadge } from '../NotesBadge'

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
  const layoutLocked = useDiagramLock()
  const onDrillInto = useDrillIn()
  const { openHop } = useSequenceHop()
  const { screenToFlowPosition } = useReactFlow()
  const store = useStoreApi()
  const { updateEdgeGeometry } = useEdgeEdit()
  const dragRef = useRef<{ index: number; points: Position[] } | null>(null)
  const pendingBendRef = useRef<{
    insertAt: number
    start: Position
    origin: Position
    waypoints: Position[]
  } | null>(null)
  const geometryRef = useRef({ id, updateEdgeGeometry, screenToFlowPosition })
  geometryRef.current = { id, updateEdgeGeometry, screenToFlowPosition }

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const { screenToFlowPosition: toFlow, id: edgeId, updateEdgeGeometry: update } = geometryRef.current
      const point = toFlow({ x: event.clientX, y: event.clientY })
      const pending = pendingBendRef.current
      if (pending && !dragRef.current) {
        if (Math.hypot(point.x - pending.origin.x, point.y - pending.origin.y) < 5) return
        const next = [...pending.waypoints]
        next.splice(pending.insertAt, 0, pending.start)
        update(edgeId, { waypoints: next })
        dragRef.current = { index: pending.insertAt, points: next }
        pendingBendRef.current = null
      }
      const drag = dragRef.current
      if (!drag) return
      const next = drag.points.map((p, i) => (i === drag.index ? point : p))
      update(edgeId, { waypoints: next })
      dragRef.current = { ...drag, points: next }
    }
    const onUp = () => {
      dragRef.current = null
      pendingBendRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const waypoints = edgeData?.waypoints ?? []
  const routeOffset = useStore((state) => {
    const self = state.edges.find((edge) => edge.id === id)
    if (!self) return 0
    const sameSource = self.source
    const sameTarget = self.target
    const sameSourceHandle = self.sourceHandle ?? ''
    const sameTargetHandle = self.targetHandle ?? ''
    const twins = state.edges.filter((edge) => {
      return (
        edge.source === sameSource &&
        edge.target === sameTarget &&
        (edge.sourceHandle ?? '') === sameSourceHandle &&
        (edge.targetHandle ?? '') === sameTargetHandle
      )
    })
    if (twins.length < 2) return 0
    const ordered = [...twins].sort((a, b) => a.id.localeCompare(b.id))
    return sharedRouteOffset(
      ordered.findIndex((edge) => edge.id === id),
      ordered.length,
    )
  })
  const { path: edgePath, labelX, labelY, points } = buildEdgePath({
    routing: edgeData?.routing,
    waypoints,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    routeOffset,
  })

  const direction = edgeData?.direction ?? 'outbound'
  const label = edgeData?.label ?? 'Integration'
  const focusRelation: EdgeFocusRelation = edgeData?.focusRelation ?? 'idle'
  const isFocused = focusRelation === 'out' || focusRelation === 'in'
  const isDimmed = focusRelation === 'unrelated'
  const isPlayCurrent = Boolean(edgeData?.flowPlayCurrent)
  const hopIndex = edgeData?.flowHopIndex
  const isActive = isFocused || selected || isPlayCurrent
  const colorBy = edgeData?.colorBy ?? 'direction'
  const lineStyle = parseLineStyle(edgeData?.lineStyle)
  const lineWeight = parseLineWeight(edgeData?.lineWeight)
  const canvasAnimation = edgeData?.canvasLineAnimation !== false
  const edgeAnimation = parseLineAnimation(edgeData?.lineAnimation)
  const animationOn = canvasAnimation && (edgeAnimation || isPlayCurrent)

  const changeStatus = parseChangeStatus(edgeData?.changeStatus)
  const styledColor = resolveEdgeColor(edgeData, colorBy)
  const color =
    changeStatus !== 'unchanged'
      ? CHANGE_STATUS_COLORS[changeStatus]
      : isPlayCurrent && edgeData?.flowPathColor
        ? edgeData.flowPathColor
        : isFocused && colorBy === 'direction' && !edgeData?.color && !edgeData?.flowPathColor
          ? FOCUS_COLORS[focusRelation]
          : styledColor || DIRECTION_COLORS[direction] || '#6366f1'
  const userDash = lineStyle === 'dashed' ? '8 5' : lineStyle === 'dotted' ? '2.5 4' : undefined
  const dash = changeStatus === 'new' ? '7 4' : changeStatus === 'retired' ? '3 4' : userDash
  const weight = lineWeight === 'thin' ? 1.75 : lineWeight === 'thick' ? 4.25 : 2.75

  const showEndArrow = direction === 'outbound' || direction === 'bidirectional'
  const showStartArrow = direction === 'inbound' || direction === 'bidirectional'
  const markerEnd = showEndArrow ? `url(#arrow-end-${id})` : undefined
  const markerStart = showStartArrow ? `url(#arrow-start-${id})` : undefined

  const strokeWidth = isPlayCurrent
    ? weight + 1.8
    : isActive
      ? weight + 0.75
      : isDimmed
        ? Math.min(weight, 1.35)
        : weight
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
    if (event.button !== 0 || layoutLocked) return
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = { index, points: nextPoints }
  }

  const addWaypointAt = (event: React.PointerEvent, insertAt: number, seed: Position) => {
    if (event.button !== 0 || layoutLocked) return
    event.preventDefault()
    event.stopPropagation()
    const next = [...waypoints]
    next.splice(insertAt, 0, seed)
    updateEdgeGeometry(id, { waypoints: next })
    dragRef.current = { index: insertAt, points: next }
  }

  const beginCurveMove = (event: React.PointerEvent) => {
    if (event.button !== 0 || layoutLocked) return
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    if (Math.hypot(point.x - sourceX, point.y - sourceY) < 22) return
    if (Math.hypot(point.x - targetX, point.y - targetY) < 22) return
    event.preventDefault()
    event.stopPropagation()
    store.getState().addSelectedEdges([id])
    pendingBendRef.current = {
      insertAt: nearestWaypointInsertIndex(points, point),
      start: point,
      origin: point,
      waypoints,
    }
  }

  const removeWaypoint = (event: React.MouseEvent, index: number) => {
    event.preventDefault()
    event.stopPropagation()
    updateEdgeGeometry(id, { waypoints: waypoints.filter((_, i) => i !== index) })
  }

  const sequenceSteps = edgeData?.sequenceFlow ?? []
  const hasSequence = sequenceSteps.length > 0 || Boolean(edgeData?.subDiagram)

  const addHandles = selected
    ? Array.from({ length: waypoints.length + 1 }, (_, insertAt) => {
        const point = pointAlongPath(edgePath, (insertAt + 0.5) / (waypoints.length + 1))
        return point ? { insertAt, point } : null
      }).filter((item): item is { insertAt: number; point: Position } => item != null)
    : []

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
        {(isFocused || isPlayCurrent) && (
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
          filter: isFocused || isPlayCurrent ? `url(#glow-${id})` : undefined,
          transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
        }}
        className={`integration-edge direction-${direction} focus-${focusRelation} change-${changeStatus} ${selected ? 'selected' : ''} ${isFocused ? 'flow-highlighted' : ''} ${isPlayCurrent ? 'flow-play-current' : ''}`}
      />
      {!layoutLocked && (
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={26}
          className="edge-curve-grab"
          pointerEvents="stroke"
          onPointerDown={beginCurveMove}
        />
      )}

      {animationOn && showForwardParticle && (
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

      {animationOn && showReverseParticle && (
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

      {animationOn && (isFocused || isPlayCurrent) && (
        <circle r="3" fill={color} opacity="0.55" className="flow-particle-active">
          <animateMotion
            dur={isPlayCurrent ? '0.9s' : '1.4s'}
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
          {isPlayCurrent && (
            <span className="edge-flow-badge flow-play" style={{ background: color }}>
              FLOW {hopIndex ?? ''}
            </span>
          )}
          {isFocused && !isPlayCurrent && (
            <span className={`edge-flow-badge flow-${focusRelation}`} style={{ background: color }}>
              {hopIndex != null ? `HOP ${hopIndex}` : FOCUS_LABEL[focusRelation]}
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
            <>
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
            <button
              type="button"
              className="edge-arrow-flip nodrag nopan"
              title={edgeAnimation ? 'Turn off moving dots on this line' : 'Turn on moving dots on this line'}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                updateEdgeGeometry(id, { lineAnimation: !edgeAnimation })
              }}
            >
              {edgeAnimation ? '● Animation on' : '○ Animation off'}
            </button>
            </>
          )}
          {changeStatus !== 'unchanged' && !isDimmed && (
            <span className={`edge-change-flag change-${changeStatus}`}>
              {changeStatus === 'new' ? 'future' : changeStatus === 'modified' ? 'changed' : 'retired'}
            </span>
          )}
          {edgeData?.protocol && !isDimmed && (
            <span className="edge-protocol">{edgeData.protocol}</span>
          )}
          {!isDimmed && <NotesBadge notes={edgeData?.notes} compact title={label} />}
          {hasSequence && (
            <div className="edge-sequence">
              {sequenceSteps.length > 0 && (
                <ol className="edge-sequence-hops">
                  {sequenceSteps.map((step, index) => (
                    <li key={step.id}>
                      <button
                        type="button"
                        className="edge-sequence-hop nodrag nopan"
                        title={`Open ${step.label} in its diagram`}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          openHop(id, step)
                        }}
                      >
                        {index + 1}. {step.label}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <button
                type="button"
                className="edge-sequence-open nodrag nopan"
                title="Open this integration’s sequence diagram"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onDrillInto(id, label, 'integration')
                }}
              >
                <Layers size={12} />
                Sequence
              </button>
            </div>
          )}
        </div>
        )}

        {!isActive && !isDimmed && sequenceSteps.length > 0 && (
          <div
            className="edge-sequence-compact nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            title={sequenceSteps.map((step) => step.label).join(' → ')}
          >
            {sequenceSteps.map((step) => step.label).join(' → ')}
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
          addHandles.map(({ insertAt, point }) => (
            <div
              key={`mid-${insertAt}`}
              className="edge-waypoint-add nodrag nopan"
              title="Drag to move or bend this line"
              style={{
                transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`,
              }}
              onPointerDown={(event) => addWaypointAt(event, insertAt, point)}
            />
          ))}
      </EdgeLabelRenderer>
    </>
  )
}
