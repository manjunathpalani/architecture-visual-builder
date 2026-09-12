import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { GripHorizontal } from 'lucide-react'
import { useViewport } from '@xyflow/react'
import {
  clampPanelWidth,
  FLYOUT_PANEL_WIDTH,
  loadFlyoutPanelWidth,
  saveFlyoutPanelWidth,
} from '../utils/canvasDocks'

interface PropertiesFlyoutProps {
  nodeId: string | null
  edgeId: string | null
  compact?: boolean
  children: ReactNode
}

const GAP = 12

function anchorRect(nodeId: string | null, edgeId: string | null): DOMRect | null {
  if (nodeId) {
    const el = document.querySelector(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`)
    return el?.getBoundingClientRect() ?? null
  }
  if (edgeId) {
    const el =
      document.querySelector(`.react-flow__edge[data-id="${CSS.escape(edgeId)}"]`) ??
      document.querySelector(`.react-flow__edgelabel-renderer`)
    return el?.getBoundingClientRect() ?? null
  }
  return null
}

export function PropertiesFlyout({ nodeId, edgeId, compact = false, children }: PropertiesFlyoutProps) {
  const viewport = useViewport()
  const panelRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ top: 72, left: 72 })
  const [panelWidth, setPanelWidth] = useState(loadFlyoutPanelWidth)
  const [resizing, setResizing] = useState(false)
  const [moving, setMoving] = useState(false)
  const [pinned, setPinned] = useState(false)

  useLayoutEffect(() => {
    setPinned(false)
  }, [nodeId, edgeId])

  useEffect(() => {
    if (pinned || moving) return
    const rect = anchorRect(nodeId, edgeId)
    if (!rect) return
    const panelH = panelRef.current?.offsetHeight ?? (compact ? 40 : 420)
    const panelW = compact ? panelRef.current?.offsetWidth ?? 140 : panelWidth
    const spaceRight = window.innerWidth - rect.right
    const placeLeft = spaceRight < panelW + GAP && rect.left > spaceRight
    let left = placeLeft ? rect.left - panelW - GAP : rect.right + GAP
    let top = rect.top
    left = Math.min(Math.max(8, left), window.innerWidth - panelW - 8)
    top = Math.min(Math.max(8, top), window.innerHeight - Math.min(panelH, window.innerHeight - 16) - 8)
    setCoords({ top, left })
  }, [nodeId, edgeId, viewport.x, viewport.y, viewport.zoom, children, compact, panelWidth, pinned, moving])

  const startResize = useCallback((edge: 'left' | 'right') => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (compact) return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    const startX = event.clientX
    const startWidth = panelWidth
    handle.setPointerCapture(event.pointerId)
    setResizing(true)
    document.body.classList.add('is-panel-resizing')

    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - startX
      const next = clampPanelWidth(
        edge === 'right' ? startWidth + dx : startWidth - dx,
        FLYOUT_PANEL_WIDTH.min,
        FLYOUT_PANEL_WIDTH.max,
      )
      setPanelWidth(next)
    }
    const onUp = () => {
      handle.releasePointerCapture(event.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      document.body.classList.remove('is-panel-resizing')
      setResizing(false)
      setPanelWidth((current) => {
        saveFlyoutPanelWidth(current)
        return current
      })
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  }, [compact, panelWidth])

  const startMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (compact) return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    const startX = event.clientX
    const startY = event.clientY
    const startLeft = coords.left
    const startTop = coords.top
    const width = panelRef.current?.offsetWidth ?? panelWidth
    handle.setPointerCapture(event.pointerId)
    setMoving(true)
    setPinned(true)
    document.body.classList.add('is-panel-resizing')

    const onMove = (move: PointerEvent) => {
      const left = Math.min(
        Math.max(8, startLeft + (move.clientX - startX)),
        window.innerWidth - Math.min(width, window.innerWidth - 16) - 8,
      )
      const top = Math.min(
        Math.max(8, startTop + (move.clientY - startY)),
        window.innerHeight - 48,
      )
      setCoords({ left, top })
    }
    const onUp = () => {
      handle.releasePointerCapture(event.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      document.body.classList.remove('is-panel-resizing')
      setMoving(false)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  }, [compact, coords.left, coords.top, panelWidth])

  if (!nodeId && !edgeId) return null

  return (
    <div
      ref={panelRef}
      className={`properties-flyout nodrag nopan ${compact ? 'is-compact' : ''}${resizing ? ' is-resizing' : ''}${moving ? ' is-moving' : ''}`}
      style={{ top: coords.top, left: coords.left, width: compact ? 'auto' : panelWidth }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {!compact && (
        <>
          <div
            className="properties-flyout-move"
            onPointerDown={startMove}
            title="Drag to move properties on the screen"
          >
            <GripHorizontal size={14} />
            Drag to move
          </div>
          <div
            className="panel-resize-handle panel-resize-handle-left"
            onPointerDown={startResize('left')}
            title="Drag to resize"
          />
          <div
            className="panel-resize-handle panel-resize-handle-right"
            onPointerDown={startResize('right')}
            title="Drag to resize"
          />
        </>
      )}
      {children}
    </div>
  )
}
