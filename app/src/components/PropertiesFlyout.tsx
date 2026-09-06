import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useViewport } from '@xyflow/react'

interface PropertiesFlyoutProps {
  nodeId: string | null
  edgeId: string | null
  compact?: boolean
  children: ReactNode
}

const FLYOUT_WIDTH = 340
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

  useLayoutEffect(() => {
    const rect = anchorRect(nodeId, edgeId)
    if (!rect) return
    const panelH = panelRef.current?.offsetHeight ?? (compact ? 40 : 420)
    const panelW = compact ? panelRef.current?.offsetWidth ?? 140 : FLYOUT_WIDTH
    const spaceRight = window.innerWidth - rect.right
    const placeLeft = spaceRight < panelW + GAP && rect.left > spaceRight
    let left = placeLeft ? rect.left - panelW - GAP : rect.right + GAP
    let top = rect.top
    left = Math.min(Math.max(8, left), window.innerWidth - panelW - 8)
    top = Math.min(Math.max(8, top), window.innerHeight - Math.min(panelH, window.innerHeight - 16) - 8)
    setCoords({ top, left })
  }, [nodeId, edgeId, viewport.x, viewport.y, viewport.zoom, children])

  if (!nodeId && !edgeId) return null

  return (
    <div
      ref={panelRef}
      className={`properties-flyout nodrag nopan ${compact ? 'is-compact' : ''}`}
      style={{ top: coords.top, left: coords.left, width: compact ? 'auto' : FLYOUT_WIDTH }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  )
}
