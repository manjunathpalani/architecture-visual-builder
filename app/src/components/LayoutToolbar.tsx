import { useCallback, useState } from 'react'
import { useReactFlow, type Edge, type Node } from '@xyflow/react'
import { Columns3, Grid3x3, Maximize2, Minimize2, Workflow } from 'lucide-react'
import { layoutByTier, layoutFlow, layoutGrid } from '../utils/autoLayout'
import type { IntegrationEdgeData, IntegrationNodeData } from '../utils/jsonIO'

const STORAGE_KEY = 'avb-arrange-toolbar-minimised'

function loadMinimised(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function saveMinimised(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

interface LayoutToolbarProps {
  onLayoutApplied: (nodes: Node<IntegrationNodeData>[], edges: Edge<IntegrationEdgeData>[]) => void
  embedded?: boolean
}

export function LayoutToolbar({ onLayoutApplied, embedded = false }: LayoutToolbarProps) {
  const { getNodes, getEdges, setNodes, fitView } = useReactFlow()
  const [minimised, setMinimised] = useState(loadMinimised)

  const applyLayout = useCallback(
    (layoutFn: (nodes: Node<IntegrationNodeData>[], edges: Edge[]) => Node<IntegrationNodeData>[]) => {
      const nodes = getNodes() as Node<IntegrationNodeData>[]
      const edges = getEdges() as Edge<IntegrationEdgeData>[]
      const layouted = layoutFn(nodes, edges)
      setNodes(layouted)
      onLayoutApplied(layouted, edges)
      window.setTimeout(() => fitView({ padding: 0.18, duration: 450 }), 60)
    },
    [getNodes, getEdges, setNodes, fitView, onLayoutApplied],
  )

  const toggle = () => {
    setMinimised((prev) => {
      const next = !prev
      saveMinimised(next)
      return next
    })
  }

  if (!embedded && minimised) {
    return (
      <div className="layout-toolbar minimised">
        <button
          type="button"
          className="drawing-toolbar-restore"
          title="Show arrange"
          onClick={toggle}
        >
          <Workflow size={14} />
          Arrange
          <Maximize2 size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className={embedded ? 'canvas-side-arrange' : 'layout-toolbar'}>
      {!embedded && <span className="layout-toolbar-label">Arrange</span>}
      <button
        type="button"
        className="layout-btn"
        title="Flow layout — follows integration connections left to right"
        onClick={() => applyLayout((n, e) => layoutFlow(n, e, 'LR'))}
      >
        <Workflow size={15} />
        Flow
      </button>
      <button
        type="button"
        className="layout-btn"
        title="Tier layout — SaaS → Middleware → Cloud → On-Premise columns"
        onClick={() => applyLayout((n) => layoutByTier(n))}
      >
        <Columns3 size={15} />
        Tiers
      </button>
      <button
        type="button"
        className="layout-btn"
        title="Grid layout — evenly spaced grid for visibility"
        onClick={() => applyLayout((n) => layoutGrid(n))}
      >
        <Grid3x3 size={15} />
        Grid
      </button>
      <button
        type="button"
        className="layout-btn"
        title="Fit entire diagram to screen"
        onClick={() => fitView({ padding: 0.18, duration: 450 })}
      >
        <Maximize2 size={15} />
        Fit
      </button>
      {!embedded && (
        <>
          <span className="drawing-toolbar-divider" />
          <button
            type="button"
            className="drawing-tool-btn"
            title="Minimise arrange"
            onClick={toggle}
          >
            <Minimize2 size={15} />
          </button>
        </>
      )}
    </div>
  )
}