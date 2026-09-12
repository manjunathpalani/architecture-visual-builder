import {
  cloneElement,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
  addEdge,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useNodesInitialized,
  useReactFlow,
  useStoreApi,
  useViewport,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnConnect,
} from '@xyflow/react'
import { Pause, Play, SlidersHorizontal, Sparkles } from 'lucide-react'
import '@xyflow/react/dist/style.css'
import type { DrawingShapeKind, PaletteItem } from '../types'
import { getFlowNodeType } from '../types'
import {
  generateId,
  type EdgeFocusRelation,
  type IntegrationEdgeData,
  type IntegrationNodeData,
} from '../utils/jsonIO'
import type { ArchitectureDocument } from '../types'
import type { DiagramPath, DrawingElement, DrawingPoint, DrawingTool } from '../types/diagram'
import { isShapeDrawingTool, shapeKindFromTool } from '../types/diagram'
import {
  documentToFlowAtPath,
  getDiagramView,
  syncFlowToDocument,
  updateDrawingsAtPath,
} from '../utils/diagramNavigation'
import {
  applyClipboardToView,
  cloneClipboard,
  collectClipboardPayload,
  isTypingTarget,
  nextPasteGeneration,
  readClipboard,
  removeSelectionFromView,
  writeClipboard,
} from '../utils/diagramClipboard'
import {
  DRAWING_COLORS,
  RECT_HANDLES,
  arrowHead,
  boxesIntersect,
  drawingBounds,
  hitTestDrawing,
  hitTestRectHandle,
  pathToSvg,
  rectFromPoints,
  rectHandlePosition,
  rectToCornerPoints,
  resizeRectFromHandle,
  type DrawnRect,
  type RectHandle,
} from '../utils/drawingRender'
import { IntegrationNode } from './nodes/IntegrationNode'
import { IntegrationEdge } from './edges/IntegrationEdge'
import { DiagramNode } from './nodes/DiagramNode'
import { AnnotationNode } from './nodes/AnnotationNode'
import { GroupNode } from './nodes/GroupNode'
import { ShapeNode } from './nodes/ShapeNode'
import { CanvasSidePanel } from './CanvasSidePanel'
import { PropertiesFlyout } from './PropertiesFlyout'
import { DrawingToolbar, SHAPE_TOOLS } from './DrawingToolbar'
import { LayoutToolbar } from './LayoutToolbar'
import { getMinimapColor } from '../utils/nodeStyle'
import {
  captureCanvasImage,
  captureReactFlowPng,
  type DiagramImage,
  type DiagramImageFormat,
} from '../utils/captureDiagram'
import {
  findPathBetween,
  isolateFlowPath,
  loadFlowStyle,
  longestFlowPath,
  saveFlowStyle,
  traceFromSinglePath,
  traceSelectionFlow,
  type FlowPath,
  type FlowStyle,
  type FlowTrace,
} from '../utils/flowTrace'
import {
  loadArchitectureStateView,
  saveArchitectureStateView,
  type ArchitectureStateView,
} from '../utils/architectureState'
import {
  loadCanvasSideCollapsed,
  loadDiagramLayoutLocked,
  loadPropertiesPlacement,
  saveCanvasSideCollapsed,
  saveDiagramLayoutLocked,
  savePropertiesPlacement,
  type PropertiesPlacement,
} from '../utils/canvasDocks'
import { EdgeEditContext } from './edges/edgeEdit'
import { DrillInContext } from './nodes/drillInContext'
import { DiagramLockContext } from './nodes/diagramLockContext'
import { NodeTitleEditContext } from './nodes/nodeTitleEditContext'
import { IntegrationConnectionLine } from './edges/ConnectionLine'

const nodeTypes = {
  integration: IntegrationNode,
  diagram: DiagramNode,
  annotation: AnnotationNode,
  group: GroupNode,
  shape: ShapeNode,
}
const edgeTypes = { integration: IntegrationEdge }

function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    window.removeEventListener('click', swallow, true)
  }
  window.addEventListener('click', swallow, true)
}

function DrawingRectTextEditor({
  rect,
  viewport,
  color,
  fontSize,
  initialValue,
  onCommit,
  onCancel,
}: {
  rect: { x: number; y: number; width: number; height: number }
  viewport: { x: number; y: number; zoom: number }
  color: string
  fontSize: number
  initialValue: string
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState(initialValue)
  const openedAt = useRef(Date.now())

  useEffect(() => {
    openedAt.current = Date.now()
    const frame = window.requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const commit = () => {
    if (Date.now() - openedAt.current < 250) {
      ref.current?.focus()
      return
    }
    onCommit(value)
  }

  return (
    <textarea
      ref={ref}
      className="drawing-shape-text-editor nodrag nopan nowheel"
      style={{
        left: viewport.x + rect.x * viewport.zoom,
        top: viewport.y + rect.y * viewport.zoom,
        width: Math.max(48, rect.width * viewport.zoom),
        height: Math.max(32, rect.height * viewport.zoom),
        fontSize: Math.max(11, fontSize * viewport.zoom),
        color,
      }}
      value={value}
      placeholder="Add text"
      aria-label="Rectangle text"
      onChange={(event) => setValue(event.target.value)}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
        }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          onCommit(value)
        }
      }}
    />
  )
}

function renderDrawingElement(
  el: DrawingElement,
  selected: boolean,
  options?: { hideText?: boolean },
) {
  const stroke = selected ? '#6366f1' : el.color
  const strokeWidth = selected ? el.strokeWidth + 1 : el.strokeWidth

  switch (el.type) {
    case 'path':
      return (
        <path
          d={pathToSvg(el.points)}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'line':
      if (el.points.length < 2) return null
      return (
        <line
          x1={el.points[0].x}
          y1={el.points[0].y}
          x2={el.points[1].x}
          y2={el.points[1].y}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )
    case 'arrow':
      if (el.points.length < 2) return null
      return (
        <g>
          <line
            x1={el.points[0].x}
            y1={el.points[0].y}
            x2={el.points[1].x}
            y2={el.points[1].y}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <polygon
            points={arrowHead(el.points[0], el.points[1])}
            fill={stroke}
          />
        </g>
      )
    case 'rectangle': {
      if (el.points.length < 2) return null
      const rect = rectFromPoints(el.points[0], el.points[1])
      const label = el.text?.trim() ?? ''
      const showPlaceholder = selected && !label && !options?.hideText
      return (
        <g>
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={el.fill ?? 'transparent'}
            stroke={stroke}
            strokeWidth={strokeWidth}
            rx={6}
          />
          {!options?.hideText && (label || showPlaceholder) ? (
            <foreignObject
              x={rect.x + 6}
              y={rect.y + 6}
              width={Math.max(1, rect.width - 12)}
              height={Math.max(1, rect.height - 12)}
              style={{ overflow: 'visible', pointerEvents: 'none' }}
            >
              <div
                className={`drawing-shape-label ${showPlaceholder ? 'is-placeholder' : ''}`}
                style={{
                  color: showPlaceholder ? '#64748b' : stroke,
                  fontSize: el.fontSize ?? 14,
                }}
              >
                {label || 'Add text'}
              </div>
            </foreignObject>
          ) : null}
        </g>
      )
    }
    case 'text': {
      const anchor = el.points[0]
      if (!anchor) return null
      return (
        <text
          x={anchor.x}
          y={anchor.y}
          fill={stroke}
          fontSize={el.fontSize ?? 14}
          fontWeight={600}
          fontFamily="inherit"
        >
          {el.text}
        </text>
      )
    }
    default:
      return null
  }
}

function shallowPropsEqual(
  a: IntegrationNodeData['properties'] | undefined,
  b: IntegrationNodeData['properties'] | undefined,
): boolean {
  if (a === b) return true
  const left = a ?? {}
  const right = b ?? {}
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const key of keys) {
    if ((left[key] ?? '') !== (right[key] ?? '')) return false
  }
  return true
}

function reconcileFlowNodes(
  current: Node<IntegrationNodeData>[],
  incoming: Node<IntegrationNodeData>[],
): Node<IntegrationNodeData>[] {
  if (current.length === 0 && incoming.length === 0) return current
  const previous = new Map(current.map((node) => [node.id, node]))
  let changed = current.length !== incoming.length
  const next = incoming.map((node) => {
    const old = previous.get(node.id)
    if (!old) {
      changed = true
      return node
    }
    const dataSame =
      old.data.label === node.data.label &&
      old.data.systemType === node.data.systemType &&
      old.data.category === node.data.category &&
      old.data.canDrillIn === node.data.canDrillIn &&
      old.data.hasSubDiagramContent === node.data.hasSubDiagramContent &&
      old.data.isStateContext === node.data.isStateContext &&
      old.data.subDiagramStats?.systems === node.data.subDiagramStats?.systems &&
      old.data.subDiagramStats?.integrations === node.data.subDiagramStats?.integrations &&
      shallowPropsEqual(old.data.properties, node.data.properties)
    const typeSame = old.type === node.type
    const posSame = old.position.x === node.position.x && old.position.y === node.position.y
    const styleChanged =
      String(old.style?.width ?? '') !== String(node.style?.width ?? '') ||
      String(old.style?.height ?? '') !== String(node.style?.height ?? '')
    if (dataSame && typeSame && posSame && !styleChanged) return old
    changed = true
    return {
      ...old,
      type: node.type,
      position: posSame ? old.position : node.position,
      zIndex: node.zIndex ?? old.zIndex,
      style: styleChanged || !typeSame ? { ...old.style, ...node.style } : old.style,
      data: {
        ...old.data,
        ...node.data,
        isFlowFocus: old.data.isFlowFocus,
        isFlowNeighbor: old.data.isFlowNeighbor,
        isFlowPath: old.data.isFlowPath,
        isFlowPlayCurrent: old.data.isFlowPlayCurrent,
        showTouchPoints: old.data.showTouchPoints,
      },
    }
  })
  if (!changed && current.every((node, index) => node === next[index])) return current
  return next
}

function reconcileFlowEdges(
  current: Edge<IntegrationEdgeData>[],
  incoming: Edge<IntegrationEdgeData>[],
): Edge<IntegrationEdgeData>[] {
  if (current.length === 0 && incoming.length === 0) return current
  const previous = new Map(current.map((edge) => [edge.id, edge]))
  let changed = current.length !== incoming.length
  const next = incoming.map((edge) => {
    const old = previous.get(edge.id)
    if (!old) {
      changed = true
      return edge
    }
    const oldData = old.data as IntegrationEdgeData
    const incomingData = edge.data as IntegrationEdgeData
    const dataSame =
      oldData.label === incomingData.label &&
      oldData.direction === incomingData.direction &&
      oldData.protocol === incomingData.protocol &&
      oldData.frequency === incomingData.frequency &&
      oldData.dataFormat === incomingData.dataFormat &&
      oldData.description === incomingData.description &&
      oldData.interfaceSpec === incomingData.interfaceSpec &&
      oldData.color === incomingData.color &&
      oldData.lineStyle === incomingData.lineStyle &&
      oldData.lineWeight === incomingData.lineWeight &&
      oldData.changeStatus === incomingData.changeStatus &&
      oldData.routing === incomingData.routing &&
      (oldData.waypoints?.length ?? 0) === (incomingData.waypoints?.length ?? 0) &&
      oldData.jiraIssueKey === incomingData.jiraIssueKey &&
      oldData.adoWorkItemId === incomingData.adoWorkItemId &&
      old.source === edge.source &&
      old.target === edge.target &&
      old.sourceHandle === edge.sourceHandle &&
      old.targetHandle === edge.targetHandle &&
      old.label === edge.label
    if (dataSame) return old
    changed = true
    return {
      ...old,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label,
      data: {
        ...oldData,
        ...incomingData,
        focusRelation: oldData.focusRelation,
        focusNodeId: oldData.focusNodeId,
        flowPathColor: oldData.flowPathColor,
        colorBy: oldData.colorBy,
        flowHopIndex: oldData.flowHopIndex,
        flowPlayCurrent: oldData.flowPlayCurrent,
      },
    }
  })
  if (!changed && current.every((edge, index) => edge === next[index])) return current
  return next
}

interface IntegrationCanvasProps {
  document: ArchitectureDocument
  diagramPath: DiagramPath
  onDocumentChange: (
    doc: ArchitectureDocument | ((prev: ArchitectureDocument) => ArchitectureDocument),
  ) => void
  onSelectionChange: (
    node: Node<IntegrationNodeData> | null,
    edge: Edge<IntegrationEdgeData> | null,
  ) => void
  onDrillInto: (systemId: string, label: string) => void
  focusNodeId?: string | null
  onFocusComplete?: () => void
  isFullscreen?: boolean
  menusHidden?: boolean
  onToggleFullscreen?: () => void
  onToggleMenus?: () => void
  properties?: ReactNode
  selectionKey?: string | null
  onOpenAi?: () => void
}

export interface IntegrationCanvasHandle {
  capturePng: () => Promise<DiagramImage | null>
  exportImage: (format: DiagramImageFormat) => Promise<DiagramImage | null>
  copySelection: () => Promise<boolean>
  cutSelection: () => Promise<boolean>
  pasteClipboard: () => Promise<boolean>
  duplicateSelection: () => Promise<boolean>
  selectAll: () => void
}

export const IntegrationCanvas = forwardRef<IntegrationCanvasHandle, IntegrationCanvasProps>(function IntegrationCanvas({
  document,
  diagramPath,
  onDocumentChange,
  onSelectionChange,
  onDrillInto,
  focusNodeId: externalFocusNodeId,
  onFocusComplete,
  isFullscreen = false,
  menusHidden = false,
  onToggleFullscreen,
  onToggleMenus,
  properties,
  selectionKey = null,
  onOpenAi,
}, ref) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const pendingSelectRef = useRef<Set<string> | null>(null)
  const canvasAliveRef = useRef(true)
  const clipboardApiRef = useRef({
    copySelection: async () => false,
    cutSelection: async () => false,
    pasteClipboard: async () => false,
    duplicateSelection: async () => false,
    selectAll: () => undefined as void,
  })
  const {
    screenToFlowPosition,
    getNode,
    getNodes,
    getViewport,
    setViewport,
    setCenter,
    setNodes: setFlowNodes,
    fitView,
  } = useReactFlow()
  const store = useStoreApi()
  const viewport = useViewport()
  const nodesInitialized = useNodesInitialized()
  const didFitRef = useRef(false)

  const diagramView = getDiagramView(document, diagramPath)
  const drawings = diagramView.drawings
  const drawingsRef = useRef(drawings)
  drawingsRef.current = drawings
  const ignoreDrawingClearRef = useRef(false)

  useImperativeHandle(
    ref,
    () => ({
      capturePng: () => captureReactFlowPng(getNodes(), reactFlowWrapper.current),
      exportImage: async (format: DiagramImageFormat) => {
        const wrapper = reactFlowWrapper.current
        if (!wrapper) return null
        const previous = getViewport()
        wrapper.classList.add('diagram-exporting')
        try {
          fitView({ padding: 0.16, duration: 0 })
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve())
          })
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 60)
          })
          return await captureCanvasImage(wrapper, format)
        } finally {
          wrapper.classList.remove('diagram-exporting')
          void setViewport(previous, { duration: 0 })
        }
      },
      copySelection: () => clipboardApiRef.current.copySelection(),
      cutSelection: () => clipboardApiRef.current.cutSelection(),
      pasteClipboard: () => clipboardApiRef.current.pasteClipboard(),
      duplicateSelection: () => clipboardApiRef.current.duplicateSelection(),
      selectAll: () => clipboardApiRef.current.selectAll(),
    }),
    [fitView, getNodes, getViewport, setViewport],
  )

  const [drawTool, setDrawTool] = useState<DrawingTool>('select')
  const [drawColor, setDrawColor] = useState(DRAWING_COLORS[0])
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null)
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<Set<string>>(() => new Set())
  const [editingDrawingId, setEditingDrawingId] = useState<string | null>(null)
  const [draftPoints, setDraftPoints] = useState<DrawingPoint[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingOverrides, setDrawingOverrides] = useState<Map<string, DrawingElement>>(() => new Map())
  const drawingEditRef = useRef<
    | { kind: 'resize'; id: string; handle: RectHandle; startRect: DrawnRect }
    | { kind: 'move'; id: string; startPoint: DrawingPoint; originals: DrawingElement[] }
    | null
  >(null)
  const drawingMoveWithNodesRef = useRef<{
    start: { x: number; y: number }
    originals: DrawingElement[]
  } | null>(null)

  const applyDrawingSelection = useCallback((ids: string[], primary?: string | null) => {
    const unique = [...new Set(ids)]
    const focus = primary && unique.includes(primary) ? primary : unique[unique.length - 1] ?? null
    setSelectedDrawingIds((current) => {
      if (current.size === unique.length && unique.every((id) => current.has(id))) return current
      return new Set(unique)
    })
    setSelectedDrawingId((current) => (current === focus ? current : focus))
    if (!focus) setEditingDrawingId((current) => (current == null ? current : null))
  }, [])

  useEffect(() => {
    let lastKey = ''
    return store.subscribe((state) => {
      const rect = state.userSelectionRect
      if (!rect || rect.width < 4 || rect.height < 4) return
      const key = `${rect.x.toFixed(1)},${rect.y.toFixed(1)},${rect.width.toFixed(1)},${rect.height.toFixed(1)}`
      if (key === lastKey) return
      lastKey = key
      const dom = state.domNode
      if (!dom) return
      ignoreDrawingClearRef.current = true
      const box = dom.getBoundingClientRect()
      const a = screenToFlowPosition({ x: box.left + rect.x, y: box.top + rect.y })
      const b = screenToFlowPosition({
        x: box.left + rect.x + rect.width,
        y: box.top + rect.y + rect.height,
      })
      const flowBox = {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y),
      }
      const hits = drawingsRef.current.filter((drawing) => {
        const bounds = drawingBounds(drawing)
        return bounds ? boxesIntersect(bounds, flowBox) : false
      })
      applyDrawingSelection(
        hits.map((drawing) => drawing.id),
        hits.find((drawing) => drawing.type === 'rectangle')?.id ?? hits[0]?.id ?? null,
      )
    })
  }, [applyDrawingSelection, screenToFlowPosition, store])

  useEffect(() => {
    const onUp = () => {
      window.setTimeout(() => {
        ignoreDrawingClearRef.current = false
      }, 250)
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [])
  /** Selected box id — drives connector flow highlighting */
  const [flowFocusId, setFlowFocusId] = useState<string | null>(null)
  const [flowEdgeId, setFlowEdgeId] = useState<string | null>(null)
  const [flowEndId, setFlowEndId] = useState<string | null>(null)
  const [flowStyle, setFlowStyle] = useState<FlowStyle>(loadFlowStyle)
  const [flowTrace, setFlowTrace] = useState<FlowTrace | null>(null)
  const [highlightedPathId, setHighlightedPathId] = useState<string | null>(null)
  const [playHopIndex, setPlayHopIndex] = useState(-1)
  const [isPlayingFlow, setIsPlayingFlow] = useState(false)
  const pendingPlayRef = useRef(false)
  const [stateView, setStateView] = useState<ArchitectureStateView>(loadArchitectureStateView)
  const [sideCollapsed, setSideCollapsed] = useState(loadCanvasSideCollapsed)
  const [layoutLocked, setLayoutLocked] = useState(loadDiagramLayoutLocked)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [propertiesPlacement, setPropertiesPlacement] = useState<PropertiesPlacement>(loadPropertiesPlacement)
  const [flyoutDismissed, setFlyoutDismissed] = useState(false)

  const initial = documentToFlowAtPath(document, diagramPath, stateView)
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)

  useEffect(() => {
    canvasAliveRef.current = true
    return () => {
      canvasAliveRef.current = false
    }
  }, [])

  const patchDocument = useCallback(
    (updater: (prev: ArchitectureDocument) => ArchitectureDocument) => {
      if (!canvasAliveRef.current) return
      onDocumentChange(updater)
    },
    [onDocumentChange],
  )

  useEffect(() => {
    const flow = documentToFlowAtPath(document, diagramPath, stateView)
    setNodes((current) => {
      const merged = reconcileFlowNodes(current, flow.nodes)
      const pick = pendingSelectRef.current
      if (!pick) return merged
      pendingSelectRef.current = null
      return merged.map((node) => ({ ...node, selected: pick.has(node.id) }))
    })
    setEdges((current) => reconcileFlowEdges(current, flow.edges))
  }, [document, diagramPath, setEdges, setNodes, stateView])

  const isShapeTool = isShapeDrawingTool(drawTool)
  const isDrawMode = drawTool !== 'select'
  const shapeSelectEnabled = isShapeTool || !isDrawMode

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const flowStyleRef = useRef(flowStyle)
  const flowFocusIdRef = useRef(flowFocusId)
  const flowEdgeIdRef = useRef(flowEdgeId)
  const flowEndIdRef = useRef(flowEndId)
  const highlightedPathIdRef = useRef(highlightedPathId)
  nodesRef.current = nodes
  edgesRef.current = edges
  flowStyleRef.current = flowStyle
  flowFocusIdRef.current = flowFocusId
  flowEdgeIdRef.current = flowEdgeId
  flowEndIdRef.current = flowEndId
  highlightedPathIdRef.current = highlightedPathId

  const applyFlowFocus = useCallback((
    selectedId: string | null,
    selectedEdgeId: string | null = null,
    force = false,
    endNodeId: string | null = null,
  ) => {
    if (
      !force &&
      selectedId === flowFocusIdRef.current &&
      selectedEdgeId === flowEdgeIdRef.current &&
      endNodeId === flowEndIdRef.current
    ) {
      return
    }

    if (!force) {
      pendingPlayRef.current = false
      highlightedPathIdRef.current = null
      setHighlightedPathId(null)
      setIsPlayingFlow(false)
      setPlayHopIndex(-1)
    }

    flowFocusIdRef.current = selectedId
    flowEdgeIdRef.current = selectedEdgeId
    flowEndIdRef.current = endNodeId
    setFlowFocusId(selectedId)
    setFlowEdgeId(selectedEdgeId)
    setFlowEndId(endNodeId)

    const style = flowStyleRef.current
    const currentEdges = edgesRef.current
    const labels = new Map(nodesRef.current.map((n) => [n.id, n.data.label]))
    const hasSelection = Boolean(selectedId || selectedEdgeId)
    const useChain = style.scope === 'chain' || Boolean(endNodeId)
    const showTouches = style.scope === 'touches' || style.scope === 'chain' || Boolean(endNodeId)
    let trace: FlowTrace | null = null
    if (hasSelection && selectedId && endNodeId) {
      const between = findPathBetween(currentEdges, labels, selectedId, endNodeId)
      trace = between ? traceFromSinglePath(between) : traceSelectionFlow(currentEdges, labels, selectedId, selectedEdgeId, true)
    } else if (hasSelection) {
      trace = traceSelectionFlow(currentEdges, labels, selectedId, selectedEdgeId, useChain)
    }
    if (trace && highlightedPathIdRef.current) {
      const isolated = isolateFlowPath(trace, highlightedPathIdRef.current)
      if (isolated.paths.length > 0) trace = isolated
    }
    setFlowTrace(trace)

    setNodes((nds) => {
      let changed = false
      const next = nds.map((n) => {
        const isFlowFocus = selectedId != null && n.id === selectedId
        const isDirect = Boolean(trace?.directNodeIds.has(n.id) && n.id !== selectedId)
        const isFlowNeighbor = isDirect
        const isFlowPath = Boolean(trace?.nodeIds.has(n.id) && n.id !== selectedId && !isDirect)
        const showTouchPoints = Boolean(showTouches && hasSelection && (isFlowFocus || isDirect || isFlowPath))
        if (
          n.data.isFlowFocus === isFlowFocus &&
          n.data.isFlowNeighbor === isFlowNeighbor &&
          n.data.isFlowPath === isFlowPath &&
          n.data.showTouchPoints === showTouchPoints
        ) {
          return n
        }
        changed = true
        return {
          ...n,
          data: { ...n.data, isFlowFocus, isFlowNeighbor, isFlowPath, showTouchPoints },
        }
      })
      return changed ? next : nds
    })

    setEdges((eds) => {
      let changed = false
      const next = eds.map((edge) => {
        let focusRelation: EdgeFocusRelation = 'idle'
        if (hasSelection) {
          focusRelation = trace?.edgeHop.get(edge.id) ?? 'unrelated'
        }
        const flowPathColor = trace?.edgePathColor.get(edge.id)
        const zIndex = focusRelation === 'out' || focusRelation === 'in' ? 10 : 0
        const data = edge.data as IntegrationEdgeData
        if (
          data.focusRelation === focusRelation &&
          data.focusNodeId === selectedId &&
          data.flowPathColor === flowPathColor &&
          data.colorBy === style.colorBy &&
          edge.zIndex === zIndex
        ) {
          return edge
        }
        changed = true
        return {
          ...edge,
          data: {
            ...data,
            focusRelation,
            focusNodeId: selectedId,
            flowPathColor,
            colorBy: style.colorBy,
          },
          zIndex,
        }
      })
      return changed ? next : eds
    })
  }, [setEdges, setNodes])

  const updateFlowStyle = (patch: Partial<FlowStyle>) => {
    const next = { ...flowStyle, ...patch }
    if (patch.scope) next.endToEnd = patch.scope === 'chain'
    setFlowStyle(next)
    saveFlowStyle(next)
  }

  const activeFlowPath: FlowPath | null = highlightedPathId
    ? flowTrace?.paths.find((path) => path.id === highlightedPathId) ?? null
    : flowEndId
      ? flowTrace?.paths[0] ?? null
      : flowStyle.scope === 'chain' || isPlayingFlow
        ? longestFlowPath(flowTrace)
        : null

  const highlightFlowPath = (pathId: string | null) => {
    highlightedPathIdRef.current = pathId
    setHighlightedPathId(pathId)
    if (!pathId) {
      setIsPlayingFlow(false)
      setPlayHopIndex(-1)
    }
    applyFlowFocus(flowFocusIdRef.current, flowEdgeIdRef.current, true, flowEndIdRef.current)
  }

  const playFlow = (pathId?: string) => {
    const path =
      (pathId ? flowTrace?.paths.find((item) => item.id === pathId) : null) ??
      (highlightedPathIdRef.current
        ? flowTrace?.paths.find((item) => item.id === highlightedPathIdRef.current)
        : null) ??
      longestFlowPath(flowTrace)
    if (!path || path.edgeIds.length === 0) {
      if (flowStyle.scope !== 'chain') {
        pendingPlayRef.current = true
        updateFlowStyle({ scope: 'chain', endToEnd: true })
      }
      return
    }
    highlightedPathIdRef.current = path.id
    setHighlightedPathId(path.id)
    setPlayHopIndex(0)
    setIsPlayingFlow(true)
    applyFlowFocus(flowFocusIdRef.current, flowEdgeIdRef.current, true, flowEndIdRef.current)
  }

  const stopFlowPlay = () => {
    pendingPlayRef.current = false
    setIsPlayingFlow(false)
    setPlayHopIndex(-1)
  }

  const updateStateView = (view: ArchitectureStateView) => {
    setStateView(view)
    saveArchitectureStateView(view)
    const flow = documentToFlowAtPath(document, diagramPath, view)
    setNodes(flow.nodes)
    setEdges(flow.edges)
  }

  const toggleSidePanel = () => {
    setSideCollapsed((prev) => {
      const next = !prev
      saveCanvasSideCollapsed(next)
      return next
    })
  }

  const updatePropertiesPlacement = (placement: PropertiesPlacement) => {
    setPropertiesPlacement(placement)
    savePropertiesPlacement(placement)
    if (placement === 'flyout') setFlyoutDismissed(false)
  }

  const toggleLayoutLock = () => {
    setLayoutLocked((current) => {
      const next = !current
      saveDiagramLayoutLocked(next)
      return next
    })
  }

  useEffect(() => {
    setFlyoutDismissed(false)
  }, [selectionKey])

  const expandSidePanel = () => {
    setSideCollapsed((prev) => {
      if (!prev) return prev
      saveCanvasSideCollapsed(false)
      return false
    })
  }

  const selectDrawTool = (tool: DrawingTool) => {
    setDrawTool(tool)
    applyDrawingSelection([])
    setDraftPoints([])
    setIsDrawing(false)
  }

  useEffect(() => {
    applyFlowFocus(flowFocusIdRef.current, flowEdgeIdRef.current, true, flowEndIdRef.current)
  }, [applyFlowFocus, flowStyle.colorBy, flowStyle.scope])

  useEffect(() => {
    if (!pendingPlayRef.current || !flowTrace || flowTrace.paths.length === 0) return
    pendingPlayRef.current = false
    const path = longestFlowPath(flowTrace)
    if (!path) return
    highlightedPathIdRef.current = path.id
    setHighlightedPathId(path.id)
    setPlayHopIndex(0)
    setIsPlayingFlow(true)
    applyFlowFocus(flowFocusIdRef.current, flowEdgeIdRef.current, true, flowEndIdRef.current)
  }, [applyFlowFocus, flowTrace])

  useEffect(() => {
    if (!isPlayingFlow) return
    const path =
      (highlightedPathId ? flowTrace?.paths.find((item) => item.id === highlightedPathId) : null) ??
      longestFlowPath(flowTrace)
    if (!path || path.edgeIds.length === 0) {
      setIsPlayingFlow(false)
      return
    }
    const timer = window.setInterval(() => {
      setPlayHopIndex((index) => {
        const next = index + 1
        return next >= path.edgeIds.length ? 0 : next
      })
    }, 1100)
    return () => window.clearInterval(timer)
  }, [flowTrace, highlightedPathId, isPlayingFlow])

  useEffect(() => {
    const path =
      highlightedPathId
        ? flowTrace?.paths.find((item) => item.id === highlightedPathId) ?? null
        : flowEndId
          ? flowTrace?.paths[0] ?? null
          : null
    const currentEdgeId = isPlayingFlow && path ? path.edgeIds[Math.max(0, playHopIndex)] ?? null : null
    const currentNodeId =
      isPlayingFlow && path
        ? path.nodeIds[Math.min(Math.max(0, playHopIndex) + 1, path.nodeIds.length - 1)] ?? null
        : null

    setEdges((eds) => {
      let changed = false
      const next = eds.map((edge) => {
        const hopIndex = path ? path.edgeIds.indexOf(edge.id) : -1
        const flowHopIndex = hopIndex >= 0 ? hopIndex + 1 : undefined
        const flowPlayCurrent = edge.id === currentEdgeId
        const data = edge.data as IntegrationEdgeData
        if (data.flowHopIndex === flowHopIndex && data.flowPlayCurrent === flowPlayCurrent) return edge
        changed = true
        return { ...edge, data: { ...data, flowHopIndex, flowPlayCurrent } }
      })
      return changed ? next : eds
    })

    setNodes((nds) => {
      let changed = false
      const next = nds.map((node) => {
        const isFlowPlayCurrent = node.id === currentNodeId
        if (node.data.isFlowPlayCurrent === isFlowPlayCurrent) return node
        changed = true
        return { ...node, data: { ...node.data, isFlowPlayCurrent } }
      })
      return changed ? next : nds
    })
  }, [flowEndId, flowTrace, highlightedPathId, isPlayingFlow, playHopIndex, setEdges, setNodes])

  useEffect(() => {
    if (!nodesInitialized || nodes.length === 0 || didFitRef.current) return
    didFitRef.current = true
    const frame = window.requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 0 })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [fitView, nodesInitialized, nodes.length])

  const saveDrawings = useCallback(
    (next: DrawingElement[]) => {
      patchDocument((prev) => updateDrawingsAtPath(prev, diagramPath, next))
    },
    [diagramPath, patchDocument],
  )

  const syncDocument = useCallback(
    (nextNodes: Node<IntegrationNodeData>[], nextEdges: Edge<IntegrationEdgeData>[]) => {
      patchDocument((prev) => syncFlowToDocument(prev, diagramPath, nextNodes, nextEdges))
    },
    [diagramPath, patchDocument],
  )

  const commitDrawing = useCallback(
    (type: DrawingElement['type'], points: DrawingPoint[], extra?: Partial<DrawingElement>) => {
      if (points.length === 0) return
      if (type !== 'path' && type !== 'text' && points.length < 2) return

      const element: DrawingElement = {
        id: generateId('draw'),
        type,
        points,
        color: drawColor,
        strokeWidth: type === 'path' ? 2.5 : 2,
        fill: type === 'rectangle' ? `${drawColor}18` : undefined,
        fontSize: 14,
        ...extra,
      }
      saveDrawings([...drawings, element])
      setDraftPoints([])
      setIsDrawing(false)
      if (type === 'rectangle') {
        applyDrawingSelection([element.id], element.id)
        setEditingDrawingId(element.id)
        swallowNextClick()
      }
    },
    [applyDrawingSelection, drawColor, drawings, saveDrawings],
  )

  const commitShapeNode = useCallback(
    (kind: DrawingShapeKind, a: DrawingPoint, b: DrawingPoint) => {
      const rect = rectFromPoints(a, b)
      const width = Math.max(rect.width, 80)
      const height = Math.max(rect.height, 60)
      const newNode: Node<IntegrationNodeData> = {
        id: generateId('shape'),
        type: 'shape',
        position: { x: rect.x, y: rect.y },
        zIndex: 0,
        selected: true,
        data: {
          systemType: 'shape',
          label: '',
          category: 'Drawing',
          properties: {
            shape: kind,
            color: drawColor,
            fill: `${drawColor}22`,
            width: String(Math.round(width)),
            height: String(Math.round(height)),
          },
          canDrillIn: false,
        },
        style: { width, height },
      }
      pendingSelectRef.current = new Set([newNode.id])
      const updated = [...nodesRef.current.map((node) => ({ ...node, selected: false })), newNode]
      nodesRef.current = updated
      setNodes(updated)
      syncDocument(updated, edgesRef.current)
      setDraftPoints([])
      setIsDrawing(false)
      applyDrawingSelection([])
      applyFlowFocus(null)
      onSelectionChange(newNode, null)
      swallowNextClick()
      window.setTimeout(() => {
        setNodes((current) => current.map((node) => ({ ...node, selected: node.id === newNode.id })))
        setEditingNodeId(newNode.id)
      }, 40)
    },
    [applyDrawingSelection, applyFlowFocus, drawColor, onSelectionChange, setNodes, syncDocument],
  )

  const flowPoint = useCallback(
    (event: React.MouseEvent) =>
      screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    [screenToFlowPosition],
  )

  const handleShapePaneMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (!isShapeTool || layoutLocked || event.button !== 0) return
      const target = event.target as HTMLElement
      if (!target.closest('.react-flow__pane')) return
      if (
        target.closest(
          '.react-flow__node, .react-flow__edge, .react-flow__handle, .react-flow__resize-control, .react-flow__nodesselection, .react-flow__minimap, .react-flow__controls, .floating-toolbar',
        )
      ) {
        return
      }
      event.preventDefault()
      const start = flowPoint(event)
      setIsDrawing(true)
      setDraftPoints([start])
      applyDrawingSelection([])
      let latest: DrawingPoint[] = [start, start]
      const onMove = (move: MouseEvent) => {
        const point = screenToFlowPosition({ x: move.clientX, y: move.clientY })
        latest = [start, point]
        setDraftPoints(latest)
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        if (!isShapeDrawingTool(drawTool)) {
          setIsDrawing(false)
          setDraftPoints([])
          return
        }
        commitShapeNode(shapeKindFromTool(drawTool), latest[0], latest[1] ?? latest[0])
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [applyDrawingSelection, commitShapeNode, drawTool, flowPoint, isShapeTool, layoutLocked, screenToFlowPosition],
  )

  const beginRectangleEdit = useCallback(
    (
      edit:
        | { kind: 'resize'; id: string; handle: RectHandle; startRect: DrawnRect }
        | { kind: 'move'; id: string; startPoint: DrawingPoint; originals: DrawingElement[] },
    ) => {
      drawingEditRef.current = edit
      setIsDrawing(false)
      setDraftPoints([])
    },
    [],
  )

  const handleOverlayMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return
      const point = flowPoint(event)
      const handleSize = 10 / Math.max(viewport.zoom, 0.2)
      const selected = drawings.find((d) => d.id === selectedDrawingId)
      if (selected?.type === 'rectangle' && selected.points.length >= 2) {
        const rect = rectFromPoints(selected.points[0], selected.points[1])
        const handle = hitTestRectHandle(rect, point, handleSize)
        if (handle) {
          event.stopPropagation()
          beginRectangleEdit({ kind: 'resize', id: selected.id, handle, startRect: rect })
          return
        }
        if (drawTool !== 'eraser' && drawTool !== 'text' && hitTestDrawing(selected, point)) {
          event.stopPropagation()
          const group = drawings.filter((drawing) => selectedDrawingIds.has(drawing.id))
          beginRectangleEdit({
            kind: 'move',
            id: selected.id,
            startPoint: point,
            originals: (group.length > 0 ? group : [selected]).map((drawing) => ({
              ...drawing,
              points: drawing.points.map((p) => ({ ...p })),
            })),
          })
          return
        }
      }

      if (drawTool === 'eraser') {
        const hit = [...drawings].reverse().find((d) => hitTestDrawing(d, point))
        if (hit) saveDrawings(drawings.filter((d) => d.id !== hit.id))
        return
      }

      if (drawTool !== 'text') {
        const hit = [...drawings].reverse().find((d) => hitTestDrawing(d, point))
        if (hit) {
          event.stopPropagation()
          if (event.shiftKey) {
            const next = new Set(selectedDrawingIds)
            if (next.has(hit.id)) next.delete(hit.id)
            else next.add(hit.id)
            applyDrawingSelection([...next], hit.id)
          } else {
            applyDrawingSelection([hit.id], hit.id)
          }
          setIsDrawing(false)
          setDraftPoints([])
          return
        }
      }

      if (drawTool === 'text') {
        const text = window.prompt('Label text:')
        if (text?.trim()) {
          commitDrawing('text', [point], { text: text.trim() })
        }
        return
      }

      setIsDrawing(true)
      setDraftPoints([point])
      applyDrawingSelection([])
    },
    [applyDrawingSelection, beginRectangleEdit, commitDrawing, drawTool, drawings, flowPoint, saveDrawings, selectedDrawingId, selectedDrawingIds, viewport.zoom],
  )

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const edit = drawingEditRef.current
      if (!edit) return
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const current = drawings.find((d) => d.id === edit.id)
      if (!current) return

      if (edit.kind === 'resize') {
        const nextRect = resizeRectFromHandle(edit.startRect, edit.handle, point)
        setDrawingOverrides(new Map([[current.id, { ...current, points: rectToCornerPoints(nextRect) }]]))
        return
      }

      const dx = point.x - edit.startPoint.x
      const dy = point.y - edit.startPoint.y
      const next = new Map<string, DrawingElement>()
      for (const drawing of edit.originals) {
        next.set(drawing.id, {
          ...drawing,
          points: drawing.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        })
      }
      setDrawingOverrides(next)
    }

    const onUp = () => {
      const edit = drawingEditRef.current
      if (!edit) return
      drawingEditRef.current = null
      setDrawingOverrides((overrides) => {
        if (overrides.size > 0) {
          saveDrawings(drawings.map((drawing) => overrides.get(drawing.id) ?? drawing))
        }
        return new Map()
      })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drawings, saveDrawings, screenToFlowPosition])

  const handleOverlayMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isDrawing) return
      const point = flowPoint(event)

      if (drawTool === 'pen') {
        setDraftPoints((prev) => [...prev, point])
        return
      }

      setDraftPoints((prev) => (prev.length > 0 ? [prev[0], point] : [point]))
    },
    [drawTool, flowPoint, isDrawing],
  )

  const handleOverlayMouseUp = useCallback(() => {
    if (!isDrawing) return

    if (isShapeDrawingTool(drawTool)) {
      setIsDrawing(false)
      setDraftPoints([])
      return
    }

    const typeMap: Partial<Record<DrawingTool, DrawingElement['type']>> = {
      pen: 'path',
      line: 'line',
      rectangle: 'rectangle',
      arrow: 'arrow',
    }
    const type = typeMap[drawTool]
    if (type) commitDrawing(type, draftPoints)
    else {
      setIsDrawing(false)
      setDraftPoints([])
    }
  }, [commitDrawing, commitShapeNode, draftPoints, drawTool, isDrawing])

  const selectedDrawingIdRef = useRef(selectedDrawingId)
  selectedDrawingIdRef.current = selectedDrawingId
  const selectedDrawingIdsRef = useRef(selectedDrawingIds)
  selectedDrawingIdsRef.current = selectedDrawingIds
  const drawingOverridesRef = useRef(drawingOverrides)
  drawingOverridesRef.current = drawingOverrides

  const copySelection = useCallback(async () => {
    const selectedNodeIds = nodesRef.current.filter((node) => node.selected).map((node) => node.id)
    const selectedEdgeIds = edgesRef.current.filter((edge) => edge.selected).map((edge) => edge.id)
    const drawingIds = [...selectedDrawingIdsRef.current]
    const payload = collectClipboardPayload(
      document,
      diagramPath,
      selectedNodeIds,
      selectedEdgeIds,
      drawingIds,
    )
    if (!payload) return false
    const live = new Map(nodesRef.current.map((node) => [node.id, node.position]))
    payload.systems = payload.systems.map((system) => {
      const position = live.get(system.id)
      return position ? { ...system, position: { ...position } } : system
    })
    await writeClipboard(payload)
    return true
  }, [diagramPath, document])

  const pasteClipboard = useCallback(async () => {
    const payload = await readClipboard()
    if (!payload) return false
    const cloned = cloneClipboard(payload, nextPasteGeneration())
    pendingSelectRef.current = new Set(cloned.systems.map((system) => system.id))
    patchDocument((prev) => applyClipboardToView(prev, diagramPath, cloned))
    applyDrawingSelection(
      cloned.drawings.map((drawing) => drawing.id),
      cloned.drawings[0]?.id ?? null,
    )
    return true
  }, [applyDrawingSelection, diagramPath, patchDocument])

  const cutSelection = useCallback(async () => {
    const selectedNodeIds = nodesRef.current.filter((node) => node.selected).map((node) => node.id)
    const selectedEdgeIds = edgesRef.current.filter((edge) => edge.selected).map((edge) => edge.id)
    const drawingIds = [...selectedDrawingIdsRef.current]
    const copied = await copySelection()
    if (!copied) return false
    patchDocument((prev) =>
      removeSelectionFromView(prev, diagramPath, selectedNodeIds, drawingIds, selectedEdgeIds),
    )
    applyDrawingSelection([])
    onSelectionChange(null, null)
    return true
  }, [applyDrawingSelection, copySelection, diagramPath, onSelectionChange, patchDocument])

  const duplicateSelection = useCallback(async () => {
    const copied = await copySelection()
    if (!copied) return false
    return pasteClipboard()
  }, [copySelection, pasteClipboard])

  const selectAllComponents = useCallback(() => {
    if (isDrawing) return
    const currentDrawings = drawingsRef.current
    const drawingIds = currentDrawings.map((drawing) => drawing.id)
    ignoreDrawingClearRef.current = true
    setDrawTool('select')
    setNodes((current) => current.map((node) => ({ ...node, selected: true })))
    setEdges((current) => current.map((edge) => ({ ...edge, selected: false })))
    applyDrawingSelection(
      drawingIds,
      currentDrawings.find((drawing) => drawing.type === 'rectangle')?.id ?? drawingIds[0] ?? null,
    )
    applyFlowFocus(null)
    const first = nodesRef.current[0] as Node<IntegrationNodeData> | undefined
    onSelectionChange(first ?? null, null)
    window.setTimeout(() => {
      ignoreDrawingClearRef.current = false
    }, 400)
  }, [applyDrawingSelection, applyFlowFocus, isDrawing, onSelectionChange, setEdges, setNodes])

  clipboardApiRef.current = {
    copySelection,
    cutSelection,
    pasteClipboard,
    duplicateSelection,
    selectAll: selectAllComponents,
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const command = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      const hasSelection =
        nodesRef.current.some((node) => node.selected) ||
        edgesRef.current.some((edge) => edge.selected) ||
        selectedDrawingIdsRef.current.size > 0

      if (command && key === 'c') {
        if (!hasSelection) return
        event.preventDefault()
        void copySelection()
        return
      }
      if (command && key === 'x') {
        if (!hasSelection) return
        event.preventDefault()
        void cutSelection()
        return
      }
      if (command && key === 'v') {
        event.preventDefault()
        void pasteClipboard()
        return
      }
      if (command && key === 'd') {
        if (!hasSelection) return
        event.preventDefault()
        void duplicateSelection()
        return
      }
      if (command && key === 'a') {
        event.preventDefault()
        selectAllComponents()
        return
      }

      if (selectedDrawingIdsRef.current.size > 0 && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault()
        const remove = selectedDrawingIdsRef.current
        saveDrawings(drawings.filter((d) => !remove.has(d.id)))
        applyDrawingSelection([])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    copySelection,
    cutSelection,
    drawings,
    duplicateSelection,
    pasteClipboard,
    applyDrawingSelection,
    saveDrawings,
    selectAllComponents,
  ])

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<IntegrationNodeData>>[]) => {
      const permittedChanges = layoutLocked
        ? changes.filter((change) => change.type !== 'position' && change.type !== 'dimensions')
        : changes
      onNodesChange(permittedChanges)
      const shouldSync = permittedChanges.some(
        (change) =>
          change.type === 'dimensions' || (change.type === 'position' && change.dragging === false),
      )
      if (shouldSync) {
        setNodes((current) => {
          syncDocument(current, edgesRef.current)
          return current
        })
      }
    },
    [layoutLocked, onNodesChange, setNodes, syncDocument],
  )

  const updateEdgeGeometry = useCallback(
    (edgeId: string, patch: Partial<IntegrationEdgeData>) => {
      if (layoutLocked) return
      setEdges((eds) => {
        const updated = eds.map((edge) =>
          edge.id === edgeId
            ? { ...edge, data: { ...(edge.data as IntegrationEdgeData), ...patch } }
            : edge,
        )
        syncDocument(nodesRef.current, updated)
        return updated
      })
    },
    [layoutLocked, setEdges, syncDocument],
  )

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (isDrawMode || layoutLocked) return
      const newEdge: Edge<IntegrationEdgeData> = {
        id: generateId('int'),
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        type: 'integration',
        data: {
          label: 'New Integration',
          direction: 'outbound',
          protocol: 'REST API',
          frequency: 'real-time',
          dataFormat: 'JSON',
          description: '',
          routing: 'bezier',
          waypoints: [],
        },
      }
      setEdges((eds) => {
        const updated = addEdge(newEdge, eds)
        syncDocument(nodesRef.current, updated)
        return updated
      })
    },
    [isDrawMode, layoutLocked, setEdges, syncDocument],
  )

  const onReconnect = useCallback(
    (oldEdge: Edge<IntegrationEdgeData>, newConnection: Connection) => {
      if (isDrawMode || layoutLocked) return
      setEdges((eds) => {
        const updated = reconnectEdge<Edge<IntegrationEdgeData>>(oldEdge, newConnection, eds)
        syncDocument(nodesRef.current, updated)
        return updated
      })
    },
    [isDrawMode, layoutLocked, setEdges, syncDocument],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (isDrawMode || layoutLocked) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [isDrawMode, layoutLocked])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (isDrawMode || layoutLocked) return
      event.preventDefault()
      const raw = event.dataTransfer.getData('application/architecture-component')
      if (!raw) return

      const item = JSON.parse(raw) as PaletteItem
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const flowType = item.flowType ?? getFlowNodeType(item.type)

      const newNode: Node<IntegrationNodeData> = {
        id: generateId('sys'),
        type: flowType,
        position,
        zIndex: flowType === 'group' ? -1 : 0,
        data: {
          systemType: item.type,
          label: item.label,
          category: item.category,
          properties: { ...(item.defaultProperties ?? {}) },
          canDrillIn: item.type !== 'note' && item.type !== 'group' && item.type !== 'shape',
        },
        style: {
          width: item.defaultSize?.width ?? (flowType === 'group' ? 320 : flowType === 'annotation' ? 180 : 180),
          height: item.defaultSize?.height ?? (flowType === 'group' ? 200 : flowType === 'annotation' ? 120 : 90),
        },
      }

      setNodes((nds) => {
        const updated = nds.concat(newNode)
        syncDocument(updated, edges)
        return updated
      })
    },
    [edges, isDrawMode, layoutLocked, screenToFlowPosition, setNodes, syncDocument],
  )

  const persistNodePositions = useCallback(() => {
    syncDocument(nodesRef.current, edgesRef.current)
  }, [syncDocument])

  const persistMovedDrawings = useCallback(() => {
    const overrides = drawingOverridesRef.current
    if (overrides.size === 0) return
    saveDrawings(drawings.map((drawing) => overrides.get(drawing.id) ?? drawing))
    setDrawingOverrides(new Map())
    drawingMoveWithNodesRef.current = null
  }, [drawings, saveDrawings])

  const onNodeDragStart = useCallback(
    (_event: unknown, node: Node) => {
      if (selectedDrawingIdsRef.current.size === 0) {
        drawingMoveWithNodesRef.current = null
        return
      }
      drawingMoveWithNodesRef.current = {
        start: { x: node.position.x, y: node.position.y },
        originals: drawings
          .filter((drawing) => selectedDrawingIdsRef.current.has(drawing.id))
          .map((drawing) => ({
            ...drawing,
            points: drawing.points.map((point) => ({ ...point })),
          })),
      }
    },
    [drawings],
  )

  const onNodeDrag = useCallback((_event: unknown, node: Node) => {
    const move = drawingMoveWithNodesRef.current
    if (!move) return
    const dx = node.position.x - move.start.x
    const dy = node.position.y - move.start.y
    const next = new Map<string, DrawingElement>()
    for (const drawing of move.originals) {
      next.set(drawing.id, {
        ...drawing,
        points: drawing.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      })
    }
    setDrawingOverrides(next)
  }, [])

  const finishNodeTitleEdit = useCallback((nodeId: string, label: string) => {
    setNodes((current) => {
      const updated = current.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, label } } : node,
      )
      syncDocument(updated, edgesRef.current)
      return updated
    })
    setEditingNodeId(null)
  }, [setNodes, syncDocument])

  const groupSelectedNodes = useCallback(() => {
    if (layoutLocked) return
    const selectedNodes = nodesRef.current.filter((node) => node.selected && node.type !== 'group')
    if (selectedNodes.length === 0) return

    const bounds = selectedNodes.reduce(
      (result, node) => {
        const width = Number(node.measured?.width ?? node.style?.width ?? 180)
        const height = Number(node.measured?.height ?? node.style?.height ?? 90)
        return {
          left: Math.min(result.left, node.position.x),
          top: Math.min(result.top, node.position.y),
          right: Math.max(result.right, node.position.x + width),
          bottom: Math.max(result.bottom, node.position.y + height),
        }
      },
      { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    )
    const group: Node<IntegrationNodeData> = {
      id: generateId('group'),
      type: 'group',
      position: { x: bounds.left - 24, y: bounds.top - 36 },
      zIndex: -1,
      data: {
        systemType: 'group',
        label: 'Group',
        category: 'Infrastructure',
        properties: {},
        canDrillIn: false,
      },
      style: {
        width: bounds.right - bounds.left + 48,
        height: bounds.bottom - bounds.top + 72,
      },
    }
    setNodes((current) => {
      const updated = [...current, group]
      syncDocument(updated, edgesRef.current)
      return updated
    })
  }, [layoutLocked, setNodes, syncDocument])

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node<IntegrationNodeData>) => {
      if (node.type === 'shape' || node.data.systemType === 'shape') {
        setEditingNodeId(node.id)
        return
      }
      if (isDrawMode) return
      const data = node.data
      if (!data.canDrillIn) return
      onDrillInto(node.id, data.label)
    },
    [isDrawMode, onDrillInto],
  )

  useEffect(() => {
    if (!externalFocusNodeId) return
    const node = getNode(externalFocusNodeId) as Node<IntegrationNodeData> | undefined
    if (!node) {
      onFocusComplete?.()
      return
    }

    setFlowNodes((nds) =>
      nds.map((n) => ({ ...n, selected: n.id === externalFocusNodeId })),
    )
    applyFlowFocus(externalFocusNodeId)
    onSelectionChange(node, null)

    const width = Number(node.measured?.width ?? node.style?.width ?? 180)
    const height = Number(node.measured?.height ?? node.style?.height ?? 90)
    setCenter(node.position.x + width / 2, node.position.y + height / 2, {
      zoom: 1.1,
      duration: 400,
    })
    onFocusComplete?.()
  }, [applyFlowFocus, externalFocusNodeId, getNode, setCenter, setFlowNodes, onSelectionChange, onFocusComplete])

  const onSelectionChangeHandler = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      if (isDrawMode && !isShapeTool) return
      if (
        !ignoreDrawingClearRef.current &&
        selNodes.length === 1 &&
        !selEdges[0] &&
        selectedDrawingIdsRef.current.size <= 1
      ) {
        applyDrawingSelection([])
      }

      const node = (selNodes[0] as Node<IntegrationNodeData>) ?? null
      const edge = (selEdges[0] as Edge<IntegrationEdgeData>) ?? null
      const endNode = selNodes.length === 2 ? (selNodes[1] as Node<IntegrationNodeData>) : null

      if (selNodes.length > 2) {
        applyFlowFocus(null)
      } else if (node && endNode && endNode.id !== node.id) {
        applyFlowFocus(node.id, null, false, endNode.id)
      } else if (node) {
        applyFlowFocus(node.id)
      } else if (edge) {
        applyFlowFocus(null, edge.id)
      } else {
        applyFlowFocus(null)
      }

      onSelectionChange(node, edge)
    },
    [applyDrawingSelection, applyFlowFocus, isDrawMode, isShapeTool, onSelectionChange],
  )

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (drawTool !== 'select') return
      const point = flowPoint(event)
      const hit = [...drawings].reverse().find((d) => hitTestDrawing(d, point))
      if (hit) {
        if (event.shiftKey) {
          const next = new Set(selectedDrawingIdsRef.current)
          if (next.has(hit.id)) next.delete(hit.id)
          else next.add(hit.id)
          applyDrawingSelection([...next], hit.id)
        } else {
          applyDrawingSelection([hit.id], hit.id)
        }
        applyFlowFocus(null)
        onSelectionChange(null, null)
      } else if (!event.shiftKey) {
        applyDrawingSelection([])
      }
    },
    [applyDrawingSelection, applyFlowFocus, drawTool, drawings, flowPoint, onSelectionChange],
  )

  const selectedDrawing = selectedDrawingId
    ? drawings.find((drawing) => drawing.id === selectedDrawingId) ?? null
    : null
  const editingDrawing = editingDrawingId
    ? drawingOverrides.get(editingDrawingId) ??
      drawings.find((drawing) => drawing.id === editingDrawingId) ??
      null
    : null
  const editingDrawingRect =
    editingDrawing?.type === 'rectangle' && editingDrawing.points.length >= 2
      ? rectFromPoints(editingDrawing.points[0], editingDrawing.points[1])
      : null

  const updateSelectedDrawing = (patch: Partial<DrawingElement>) => {
    if (!selectedDrawing) return
    saveDrawings(
      drawings.map((drawing) =>
        drawing.id === selectedDrawing.id ? { ...drawing, ...patch } : drawing,
      ),
    )
  }

  const draftElement: DrawingElement | null =
    draftPoints.length > 0 && !isShapeTool
      ? {
          id: 'draft',
          type:
            drawTool === 'pen'
              ? 'path'
              : drawTool === 'line'
                ? 'line'
                : drawTool === 'rectangle'
                  ? 'rectangle'
                  : drawTool === 'arrow'
                    ? 'arrow'
                    : 'line',
          points: draftPoints,
          color: drawColor,
          strokeWidth: drawTool === 'pen' ? 2.5 : 2,
          fill: drawTool === 'rectangle' ? `${drawColor}18` : undefined,
        }
      : null

  const draftShapeRect =
    isShapeTool && draftPoints.length >= 1
      ? rectFromPoints(draftPoints[0], draftPoints[draftPoints.length - 1] ?? draftPoints[0])
      : null

  return (
    <div className="canvas-shell">
    <div className="canvas-wrapper" ref={reactFlowWrapper} onMouseDown={handleShapePaneMouseDown}>
      <EdgeEditContext.Provider value={{ updateEdgeGeometry }}>
      <DrillInContext.Provider value={onDrillInto}>
      <DiagramLockContext.Provider value={layoutLocked}>
      <NodeTitleEditContext.Provider
        value={{
          editingNodeId,
          startEditing: setEditingNodeId,
          finishEditing: finishNodeTitleEdit,
          cancelEditing: () => setEditingNodeId(null),
        }}
      >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={(changes) => {
          onEdgesChange(changes)
        }}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={() => {
          persistNodePositions()
          persistMovedDrawings()
        }}
        onSelectionDragStop={() => {
          persistNodePositions()
          persistMovedDrawings()
        }}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChangeHandler}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={shapeSelectEnabled && !layoutLocked}
        nodesConnectable={!isDrawMode && !layoutLocked}
        elementsSelectable={shapeSelectEnabled}
        edgesReconnectable={!isDrawMode && !layoutLocked}
        reconnectRadius={18}
        connectionMode={ConnectionMode.Loose}
        panOnDrag={isDrawMode ? false : [1, 2]}
        panActivationKeyCode="Space"
        selectionOnDrag={!isDrawMode}
        selectionMode={SelectionMode.Partial}
        selectNodesOnDrag={false}
        nodeDragThreshold={4}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.15}
        maxZoom={2}
        onInit={(instance) => {
          instance.fitView({ padding: 0.2, duration: 0 })
        }}
        snapToGrid={!isDrawMode}
        snapGrid={[16, 16]}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        selectionKeyCode={null}
        defaultEdgeOptions={{ type: 'integration', reconnectable: true }}
        connectionLineComponent={IntegrationConnectionLine}
        deleteKeyCode={isDrawMode ? null : ['Backspace', 'Delete']}
        elevateNodesOnSelect={false}
        className={[
          flowStyle.scope === 'touches' && (flowFocusId || flowEdgeId) ? 'flow-show-touches' : '',
          isPlayingFlow ? 'flow-playing' : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined}
      >
        <Background gap={16} size={1} color="#e2e8f0" />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-left"
          pannable
          zoomable
          nodeColor={(node) => {
            const data = node.data as IntegrationNodeData
            return data.properties?.color ?? getMinimapColor(data.systemType)
          }}
          maskColor="rgba(15, 23, 42, 0.08)"
        />
      </ReactFlow>
      </NodeTitleEditContext.Provider>
      </DiagramLockContext.Provider>
      </DrillInContext.Provider>
      </EdgeEditContext.Provider>

      <div
        className={`drawing-overlay ${isDrawMode && !isShapeTool ? 'drawing-active' : ''}`}
        onMouseDown={handleOverlayMouseDown}
        onMouseMove={handleOverlayMouseMove}
        onMouseUp={handleOverlayMouseUp}
        onMouseLeave={handleOverlayMouseUp}
      >
        <svg className="drawing-svg">
          <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
            {drawings.map((el) => {
              const current = drawingOverrides.get(el.id) ?? el
              const selected = selectedDrawingIds.has(el.id)
              const primary = el.id === selectedDrawingId
              const handleSize = 8 / Math.max(viewport.zoom, 0.2)
              const rect =
                current.type === 'rectangle' && current.points.length >= 2
                  ? rectFromPoints(current.points[0], current.points[1])
                  : null
              return (
                <g key={el.id}>
                  {renderDrawingElement(current, selected, { hideText: el.id === editingDrawingId })}
                  {selected && rect && (
                    <rect
                      className="drawing-selection-ring"
                      x={rect.x - 3}
                      y={rect.y - 3}
                      width={rect.width + 6}
                      height={rect.height + 6}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth={2 / Math.max(viewport.zoom, 0.2)}
                      strokeDasharray={`${7 / Math.max(viewport.zoom, 0.2)} ${4 / Math.max(viewport.zoom, 0.2)}`}
                      rx={8}
                      pointerEvents="none"
                    />
                  )}
                  {rect && (
                    <rect
                      className="drawing-hit"
                      x={rect.x}
                      y={rect.y}
                      width={Math.max(rect.width, 1)}
                      height={Math.max(rect.height, 1)}
                      fill="transparent"
                      onMouseDown={(event) => {
                        if (event.button !== 0 || drawTool === 'eraser') return
                        event.stopPropagation()
                        if (event.shiftKey) {
                          const next = new Set(selectedDrawingIds)
                          if (next.has(el.id)) next.delete(el.id)
                          else next.add(el.id)
                          applyDrawingSelection([...next], el.id)
                        } else if (!selectedDrawingIds.has(el.id)) {
                          applyDrawingSelection([el.id], el.id)
                        }
                        if (event.detail === 2) return
                        if (!selectedDrawingIds.has(el.id) && !event.shiftKey && drawTool !== 'select') return
                        const point = flowPoint(event)
                        const group = drawings.filter((drawing) =>
                          (event.shiftKey ? new Set([...selectedDrawingIds, el.id]) : selectedDrawingIds).has(drawing.id),
                        )
                        const originals = (group.length > 0 ? group : [current]).map((drawing) => ({
                          ...drawing,
                          points: drawing.points.map((p) => ({ ...p })),
                        }))
                        beginRectangleEdit({
                          kind: 'move',
                          id: el.id,
                          startPoint: point,
                          originals,
                        })
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation()
                        event.preventDefault()
                        applyDrawingSelection([el.id], el.id)
                        setEditingDrawingId(el.id)
                      }}
                    />
                  )}
                  {primary && rect && (
                    <>
                      <rect
                        className="drawing-rect-mover"
                        x={rect.x}
                        y={rect.y}
                        width={Math.max(rect.width, 1)}
                        height={Math.max(rect.height, 1)}
                        fill="transparent"
                        onMouseDown={(event) => {
                          if (event.button !== 0) return
                          if (event.detail === 2) return
                          event.stopPropagation()
                          const point = flowPoint(event)
                          const group = drawings.filter((drawing) => selectedDrawingIds.has(drawing.id))
                          beginRectangleEdit({
                            kind: 'move',
                            id: el.id,
                            startPoint: point,
                            originals: (group.length > 0 ? group : [current]).map((drawing) => ({
                              ...drawing,
                              points: drawing.points.map((p) => ({ ...p })),
                            })),
                          })
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation()
                          event.preventDefault()
                          setEditingDrawingId(el.id)
                        }}
                      />
                      {RECT_HANDLES.map(({ id, cursor }) => {
                        const pos = rectHandlePosition(rect, id)
                        return (
                          <rect
                            key={id}
                            className="drawing-resize-handle"
                            x={pos.x - handleSize / 2}
                            y={pos.y - handleSize / 2}
                            width={handleSize}
                            height={handleSize}
                            rx={1.5 / Math.max(viewport.zoom, 0.2)}
                            style={{ cursor }}
                            onMouseDown={(event) => {
                              if (event.button !== 0) return
                              event.stopPropagation()
                              beginRectangleEdit({
                                kind: 'resize',
                                id: el.id,
                                handle: id,
                                startRect: rect,
                              })
                            }}
                          />
                        )
                      })}
                    </>
                  )}
                </g>
              )
            })}
            {draftElement && <g className="drawing-draft">{renderDrawingElement(draftElement, false)}</g>}
            {draftShapeRect && (
              <rect
                className="drawing-draft"
                x={draftShapeRect.x}
                y={draftShapeRect.y}
                width={Math.max(draftShapeRect.width, 4)}
                height={Math.max(draftShapeRect.height, 4)}
                fill={`${drawColor}18`}
                stroke={drawColor}
                strokeWidth={2}
                strokeDasharray="6 4"
                rx={isShapeTool && drawTool === 'shape-rounded-rect' ? 12 : 2}
              />
            )}
          </g>
        </svg>
        {editingDrawing && editingDrawingRect && (
          <DrawingRectTextEditor
            key={editingDrawing.id}
            rect={editingDrawingRect}
            viewport={viewport}
            color={editingDrawing.color}
            fontSize={editingDrawing.fontSize ?? 14}
            initialValue={editingDrawing.text ?? ''}
            onCommit={(text) => {
              saveDrawings(
                drawings.map((drawing) =>
                  drawing.id === editingDrawing.id
                    ? { ...drawing, text: text.trim() || undefined }
                    : drawing,
                ),
              )
              setEditingDrawingId(null)
            }}
            onCancel={() => setEditingDrawingId(null)}
          />
        )}
      </div>

      <DrawingToolbar
        drawTool={drawTool}
        onSelectTool={selectDrawTool}
        drawColor={drawColor}
        onSelectColor={setDrawColor}
      />
      <LayoutToolbar
        onLayoutApplied={syncDocument}
        layoutLocked={layoutLocked}
        onToggleLayoutLock={toggleLayoutLock}
        selectedNodeCount={nodes.filter((node) => node.selected && node.type !== 'group').length}
        onGroupSelection={groupSelectedNodes}
        onSelectAll={selectAllComponents}
      />

      {onOpenAi && (
        <button
          type="button"
          className="ai-chat-launcher"
          title="Draw with AI"
          aria-label="Draw with AI"
          onClick={onOpenAi}
        >
          <Sparkles size={20} />
        </button>
      )}

      <div className="canvas-hint">
        {isDrawMode
          ? isShapeTool
            ? `Shape: ${SHAPE_TOOLS.find((t) => t.id === drawTool)?.label ?? 'Shape'} · Drag empty canvas to draw · Click a shape to select it · Use Add text`
            : drawTool === 'rectangle'
              ? 'Freehand rectangle · Drag to size · Type in the box to add text · Double-click later to edit'
              : `Drawing mode: ${drawTool} · Click and drag · Select to edit components`
          : flowEndId
            ? 'End-to-end path between the two selected components · Shift-click another box to change the end'
            : isPlayingFlow
              ? 'Playing the end-to-end flow · Click Stop flow or the empty canvas to clear'
              : flowFocusId || flowEdgeId
                ? flowStyle.scope === 'chain'
                  ? 'End-to-end chain from this component · Pick a path in Tools, then Play flow'
                  : flowStyle.scope === 'touches'
                    ? 'All touches: every system this component connects to, with flow · Click empty canvas to clear'
                    : 'Showing only boxes linked by an integration line · Click empty canvas to clear'
                : diagramPath.length === 0
                  ? 'Drag on empty canvas to select · Drag a selected box to move the group · Ctrl+A selects all'
                  : 'Select a box to highlight connected integrations · Double-click to drill in'}
        {!isDrawMode && !flowFocusId && ' · Drag on empty canvas to rubber-band select · Middle-drag or Space-drag to pan · Ctrl+A to select all'}
      </div>

      {!isDrawMode && (nodes.filter((node) => node.selected).length > 1 || selectedDrawingIds.size > 1) && (
        <div className="selection-move-hint nodrag nopan">
          {nodes.filter((node) => node.selected).length + selectedDrawingIds.size} selected
          {layoutLocked ? ' · Unlock to move' : ' · Drag any selected item to move them together'}
        </div>
      )}

      {activeFlowPath && (flowFocusId || flowEdgeId) && (
        <div className="flow-trail-overlay nodrag nopan">
          <div className="flow-trail-header">
            <strong>
              {isPlayingFlow
                ? 'Playing flow'
                : flowEndId
                  ? 'End-to-end path'
                  : highlightedPathId
                    ? 'Selected flow'
                    : 'End-to-end flow'}
            </strong>
            <span>
              {activeFlowPath.edgeIds.length} hop{activeFlowPath.edgeIds.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flow-trail">
            {activeFlowPath.labels.map((label, index) => (
              <span key={`${activeFlowPath.id}-${index}`}>
                {index > 0 && <span className="flow-trail-arrow">→</span>}
                <span
                  className={`flow-trail-node ${
                    isPlayingFlow && index === Math.min(playHopIndex + 1, activeFlowPath.labels.length - 1)
                      ? 'current'
                      : isPlayingFlow && index <= playHopIndex
                        ? 'visited'
                        : ''
                  }`}
                >
                  {label}
                </span>
              </span>
            ))}
          </div>
          <div className="flow-trail-actions">
            <button
              type="button"
              className={`flow-color-btn ${isPlayingFlow ? 'active' : ''}`}
              onClick={() => (isPlayingFlow ? stopFlowPlay() : playFlow(activeFlowPath.id))}
            >
              {isPlayingFlow ? <Pause size={12} /> : <Play size={12} />}
              {isPlayingFlow ? 'Stop' : 'Play'}
            </button>
            {highlightedPathId && (
              <button type="button" className="flow-color-btn" onClick={() => highlightFlowPath(null)}>
                Show all paths
              </button>
            )}
          </div>
        </div>
      )}

      {propertiesPlacement === 'flyout' && selectionKey && (!isDrawMode || isShapeTool) && !flyoutDismissed && (
        <PropertiesFlyout nodeId={flowFocusId} edgeId={flowEdgeId}>
          {isValidElement(properties)
            ? cloneElement(properties as ReactElement<Record<string, unknown>>, {
                variant: 'flyout',
                onDock: () => updatePropertiesPlacement('side'),
                onCloseFlyout: () => setFlyoutDismissed(true),
              })
            : properties}
        </PropertiesFlyout>
      )}
      {propertiesPlacement === 'flyout' && selectionKey && (!isDrawMode || isShapeTool) && flyoutDismissed && (
        <PropertiesFlyout nodeId={flowFocusId} edgeId={flowEdgeId} compact>
          <button
            type="button"
            className="properties-flyout-chip"
            onClick={() => setFlyoutDismissed(false)}
          >
            <SlidersHorizontal size={14} />
            Properties
          </button>
        </PropertiesFlyout>
      )}
      {selectedDrawing && (
        <aside className="drawing-properties-flyout nodrag nopan">
          <div className="drawing-properties-header">
            <strong>
              {selectedDrawingIds.size > 1
                ? `${selectedDrawingIds.size} drawings selected`
                : selectedDrawing.type === 'text'
                  ? 'Text properties'
                  : `${selectedDrawing.type} properties`}
            </strong>
            <button type="button" className="icon-btn" onClick={() => applyDrawingSelection([])} aria-label="Close drawing properties">×</button>
          </div>
          {(selectedDrawing.type === 'rectangle' || selectedDrawing.type === 'text') && (
            <>
              <label className="shape-text-property">
                Text
                <textarea
                  rows={3}
                  value={selectedDrawing.text ?? ''}
                  placeholder="Type the text shown on this rectangle"
                  onChange={(event) => updateSelectedDrawing({ text: event.target.value })}
                  onFocus={() => {
                    if (selectedDrawing.type === 'rectangle') setEditingDrawingId(null)
                  }}
                />
              </label>
              <label>
                Text size
                <input
                  type="number"
                  min={8}
                  max={72}
                  value={selectedDrawing.fontSize ?? 14}
                  onChange={(event) => updateSelectedDrawing({ fontSize: Number(event.target.value) || 14 })}
                />
              </label>
            </>
          )}
          <label>
            Stroke colour
            <input
              type="color"
              value={selectedDrawing.color}
              onChange={(event) => updateSelectedDrawing({ color: event.target.value })}
            />
          </label>
          {selectedDrawing.type === 'rectangle' && (
            <label>
              Fill colour
              <input
                type="color"
                value={selectedDrawing.fill?.slice(0, 7) ?? '#ffffff'}
                onChange={(event) => updateSelectedDrawing({ fill: `${event.target.value}22` })}
              />
            </label>
          )}
          <label>
            Stroke width
            <input
              type="range"
              min={1}
              max={8}
              step={0.5}
              value={selectedDrawing.strokeWidth}
              onChange={(event) => updateSelectedDrawing({ strokeWidth: Number(event.target.value) })}
            />
          </label>
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              const remove = selectedDrawingIds.size > 0 ? selectedDrawingIds : new Set([selectedDrawing.id])
              saveDrawings(drawings.filter((drawing) => !remove.has(drawing.id)))
              applyDrawingSelection([])
            }}
          >
            Delete
          </button>
        </aside>
      )}
    </div>

      <CanvasSidePanel
        collapsed={sideCollapsed}
        onToggle={toggleSidePanel}
        isFullscreen={isFullscreen}
        menusHidden={menusHidden}
        onToggleFullscreen={onToggleFullscreen}
        onToggleMenus={onToggleMenus}
        flowStyle={flowStyle}
        onFlowStyle={updateFlowStyle}
        flowFocusId={flowFocusId}
        flowEdgeId={flowEdgeId}
        flowTrace={flowTrace}
        highlightedPathId={highlightedPathId}
        onHighlightPath={highlightFlowPath}
        isPlayingFlow={isPlayingFlow}
        playHopIndex={playHopIndex}
        onPlayFlow={() => playFlow()}
        onStopFlow={stopFlowPlay}
        stateView={stateView}
        onStateView={updateStateView}
        properties={
          propertiesPlacement === 'flyout'
            ? undefined
            : isValidElement(properties)
              ? cloneElement(properties as ReactElement<Record<string, unknown>>, {
                  variant: 'side',
                  onUndock: selectionKey ? () => updatePropertiesPlacement('flyout') : undefined,
                })
              : properties}
        propertiesPlacement={propertiesPlacement}
        onPropertiesPlacement={updatePropertiesPlacement}
        selectionKey={selectionKey}
        onExpand={expandSidePanel}
      />
    </div>
  )
})

IntegrationCanvas.displayName = 'IntegrationCanvas'
