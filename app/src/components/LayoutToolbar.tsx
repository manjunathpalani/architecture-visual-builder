import { useCallback, useState } from 'react'
import { useReactFlow, type Edge, type Node } from '@xyflow/react'
import { BoxSelect, Columns3, Grid3x3, Lock, LockKeyholeOpen, Maximize2, RotateCcw, WandSparkles, Workflow } from 'lucide-react'
import { layoutByTier, layoutFlow, layoutGrid, layoutSmart } from '../utils/autoLayout'
import type { IntegrationEdgeData, IntegrationNodeData } from '../utils/jsonIO'
import { FloatingToolbar } from './FloatingToolbar'

interface LayoutToolbarProps {
  onLayoutApplied: (nodes: Node<IntegrationNodeData>[], edges: Edge<IntegrationEdgeData>[]) => void
  embedded?: boolean
  layoutLocked?: boolean
  onToggleLayoutLock?: () => void
  selectedNodeCount?: number
  onGroupSelection?: () => void
  onSelectAll?: () => void
}

type LayoutSnapshot = Map<
  string,
  Pick<Node<IntegrationNodeData>, 'position' | 'style'>
>

function snapshotLayout(nodes: Node<IntegrationNodeData>[]): LayoutSnapshot {
  return new Map(
    nodes.map((node) => [
      node.id,
      {
        position: { ...node.position },
        style: node.style ? { ...node.style } : undefined,
      },
    ]),
  )
}

export function LayoutToolbar({
  onLayoutApplied,
  embedded = false,
  layoutLocked = false,
  onToggleLayoutLock,
  selectedNodeCount = 0,
  onGroupSelection,
  onSelectAll,
}: LayoutToolbarProps) {
  const { getNodes, getEdges, setNodes, fitView } = useReactFlow()
  const [previousLayout, setPreviousLayout] = useState<LayoutSnapshot | null>(null)

  const applyLayout = useCallback(
    (layoutFn: (nodes: Node<IntegrationNodeData>[], edges: Edge[]) => Node<IntegrationNodeData>[]) => {
      const nodes = getNodes() as Node<IntegrationNodeData>[]
      const edges = getEdges() as Edge<IntegrationEdgeData>[]
      const layouted = layoutFn(nodes, edges)
      setPreviousLayout(snapshotLayout(nodes))
      setNodes(layouted)
      onLayoutApplied(layouted, edges)
      window.setTimeout(() => fitView({ padding: 0.18, duration: 450 }), 60)
    },
    [getNodes, getEdges, setNodes, fitView, onLayoutApplied],
  )

  const undoLayout = useCallback(() => {
    if (!previousLayout) return
    const currentNodes = getNodes() as Node<IntegrationNodeData>[]
    const currentEdges = getEdges() as Edge<IntegrationEdgeData>[]
    const restored = currentNodes.map((node) => {
      const previous = previousLayout.get(node.id)
      return previous
        ? {
            ...node,
            position: { ...previous.position },
            style: previous.style ? { ...previous.style } : undefined,
          }
        : node
    })
    setNodes(restored)
    onLayoutApplied(restored, currentEdges)
    setPreviousLayout(null)
    window.setTimeout(() => fitView({ padding: 0.18, duration: 450 }), 60)
  }, [fitView, getEdges, getNodes, onLayoutApplied, previousLayout, setNodes])

  const buttons = (
    <>
      <button
        type="button"
        className="layout-btn"
        title="Smart organise — chooses the clearest layout for this diagram"
        onClick={() => applyLayout((n, e) => layoutSmart(n, e))}
        disabled={layoutLocked}
      >
        <WandSparkles size={15} />
        Smart
      </button>
      <button
        type="button"
        className="layout-btn"
        title="Flow layout — follows integration connections left to right"
        onClick={() => applyLayout((n, e) => layoutFlow(n, e, 'LR'))}
        disabled={layoutLocked}
      >
        <Workflow size={15} />
        Flow
      </button>
      <button
        type="button"
        className="layout-btn"
        title="Tier layout — SaaS → Middleware → Cloud → On-Premise columns"
        onClick={() => applyLayout((n) => layoutByTier(n))}
        disabled={layoutLocked}
      >
        <Columns3 size={15} />
        Tiers
      </button>
      <button
        type="button"
        className="layout-btn"
        title="Grid layout — evenly spaced grid for visibility"
        onClick={() => applyLayout((n) => layoutGrid(n))}
        disabled={layoutLocked}
      >
        <Grid3x3 size={15} />
        Grid
      </button>
      {onSelectAll && (
        <button
          type="button"
          className="layout-btn"
          title="Select every component on this diagram (Ctrl+A)"
          onClick={onSelectAll}
        >
          <BoxSelect size={15} />
          Select all
        </button>
      )}
      {onGroupSelection && (
        <button
          type="button"
          className="layout-btn"
          title={selectedNodeCount ? 'Create a group boundary around the selected components' : 'Select components to group'}
          onClick={onGroupSelection}
          disabled={!selectedNodeCount || layoutLocked}
        >
          <Columns3 size={15} />
          Group
        </button>
      )}
      <button
        type="button"
        className="layout-btn"
        title="Fit entire diagram to screen"
        onClick={() => fitView({ padding: 0.18, duration: 450 })}
      >
        <Maximize2 size={15} />
        Fit
      </button>
      <button
        type="button"
        className="layout-btn"
        title={previousLayout ? 'Undo the last arrangement' : 'Nothing to undo'}
        onClick={undoLayout}
        disabled={!previousLayout || layoutLocked}
      >
        <RotateCcw size={15} />
        Undo
      </button>
      {onToggleLayoutLock && (
        <button
          type="button"
          className={`layout-btn ${layoutLocked ? 'active' : ''}`}
          title={layoutLocked ? 'Unlock diagram layout' : 'Lock diagram layout against moving or resizing'}
          onClick={onToggleLayoutLock}
          aria-pressed={layoutLocked}
        >
          {layoutLocked ? <Lock size={15} /> : <LockKeyholeOpen size={15} />}
          {layoutLocked ? 'Locked' : 'Lock'}
        </button>
      )}
    </>
  )

  if (embedded) {
    return <div className="canvas-side-arrange">{buttons}</div>
  }

  return (
    <FloatingToolbar
      storageKey="avb-arrange-toolbar-v1"
      className="layout-toolbar"
      title="Arrange"
      restoreLabel="Arrange"
      restoreIcon={<Workflow size={14} />}
      defaultDock="top-right"
    >
      {buttons}
    </FloatingToolbar>
  )
}
