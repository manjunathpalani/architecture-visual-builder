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
  addEdge,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useNodesInitialized,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnConnect,
} from '@xyflow/react'
import { SlidersHorizontal, Sparkles } from 'lucide-react'
import '@xyflow/react/dist/style.css'
import type { DrawingShapeKind, PaletteItem } from '../types'
import { DRAWING_SHAPE_LABELS, getFlowNodeType } from '../types'
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
  loadFlowStyle,
  saveFlowStyle,
  traceSelectionFlow,
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

function renderDrawingElement(el: DrawingElement, selected: boolean) {
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
      return (
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
  const viewport = useViewport()
  const nodesInitialized = useNodesInitialized()
  const didFitRef = useRef(false)

  const diagramView = getDiagramView(document, diagramPath)
  const drawings = diagramView.drawings

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
    }),
    [fitView, getNodes, getViewport, setViewport],
  )

  const [drawTool, setDrawTool] = useState<DrawingTool>('select')
  const [drawColor, setDrawColor] = useState(DRAWING_COLORS[0])
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null)
  const [draftPoints, setDraftPoints] = useState<DrawingPoint[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingOverride, setDrawingOverride] = useState<DrawingElement | null>(null)
  const drawingEditRef = useRef<
    | { kind: 'resize'; id: string; handle: RectHandle; startRect: DrawnRect }
    | { kind: 'move'; id: string; startPoint: DrawingPoint; startPoints: DrawingPoint[] }
    | null
  >(null)
  /** Selected box id — drives connector flow highlighting */
  const [flowFocusId, setFlowFocusId] = useState<string | null>(null)
  const [flowEdgeId, setFlowEdgeId] = useState<string | null>(null)
  const [flowStyle, setFlowStyle] = useState<FlowStyle>(loadFlowStyle)
  const [flowTrace, setFlowTrace] = useState<FlowTrace | null>(null)
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

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const flowStyleRef = useRef(flowStyle)
  const flowFocusIdRef = useRef(flowFocusId)
  const flowEdgeIdRef = useRef(flowEdgeId)
  nodesRef.current = nodes
  edgesRef.current = edges
  flowStyleRef.current = flowStyle
  flowFocusIdRef.current = flowFocusId
  flowEdgeIdRef.current = flowEdgeId

  const applyFlowFocus = useCallback((
    selectedId: string | null,
    selectedEdgeId: string | null = null,
    force = false,
  ) => {
    if (!force && selectedId === flowFocusIdRef.current && selectedEdgeId === flowEdgeIdRef.current) {
      return
    }

    flowFocusIdRef.current = selectedId
    flowEdgeIdRef.current = selectedEdgeId
    setFlowFocusId(selectedId)
    setFlowEdgeId(selectedEdgeId)

    const style = flowStyleRef.current
    const currentEdges = edgesRef.current
    const labels = new Map(nodesRef.current.map((n) => [n.id, n.data.label]))
    const hasSelection = Boolean(selectedId || selectedEdgeId)
    const useChain = style.scope === 'chain'
    const showTouches = style.scope === 'touches' || style.scope === 'chain'
    const trace = hasSelection
      ? traceSelectionFlow(currentEdges, labels, selectedId, selectedEdgeId, useChain)
      : null
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
    setSelectedDrawingId(null)
    setDraftPoints([])
    setIsDrawing(false)
  }

  useEffect(() => {
    applyFlowFocus(flowFocusIdRef.current, flowEdgeIdRef.current, true)
  }, [applyFlowFocus, flowStyle.colorBy, flowStyle.scope])

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
      if (type === 'rectangle') setSelectedDrawingId(element.id)
    },
    [drawColor, drawings, saveDrawings],
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
        data: {
          systemType: 'shape',
          label: DRAWING_SHAPE_LABELS[kind],
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
      setNodes((nds) => {
        const updated = nds.concat(newNode)
        syncDocument(updated, edges)
        return updated
      })
      setDraftPoints([])
      setIsDrawing(false)
      setSelectedDrawingId(null)
    },
    [drawColor, edges, setNodes, syncDocument],
  )

  const flowPoint = useCallback(
    (event: React.MouseEvent) =>
      screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    [screenToFlowPosition],
  )

  const beginRectangleEdit = useCallback(
    (
      edit:
        | { kind: 'resize'; id: string; handle: RectHandle; startRect: DrawnRect }
        | { kind: 'move'; id: string; startPoint: DrawingPoint; startPoints: DrawingPoint[] },
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
        if (drawTool === 'select' && hitTestDrawing(selected, point)) {
          event.stopPropagation()
          beginRectangleEdit({
            kind: 'move',
            id: selected.id,
            startPoint: point,
            startPoints: selected.points.map((p) => ({ ...p })),
          })
          return
        }
      }

      if (drawTool === 'eraser') {
        const hit = [...drawings].reverse().find((d) => hitTestDrawing(d, point))
        if (hit) saveDrawings(drawings.filter((d) => d.id !== hit.id))
        return
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
      setSelectedDrawingId(null)
    },
    [beginRectangleEdit, commitDrawing, drawTool, drawings, flowPoint, saveDrawings, selectedDrawingId, viewport.zoom],
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
        setDrawingOverride({
          ...current,
          points: rectToCornerPoints(nextRect),
        })
        return
      }

      const dx = point.x - edit.startPoint.x
      const dy = point.y - edit.startPoint.y
      setDrawingOverride({
        ...current,
        points: edit.startPoints.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      })
    }

    const onUp = () => {
      const edit = drawingEditRef.current
      if (!edit) return
      drawingEditRef.current = null
      setDrawingOverride((override) => {
        if (override) {
          saveDrawings(drawings.map((d) => (d.id === override.id ? override : d)))
        }
        return null
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

    if (isShapeDrawingTool(drawTool) && draftPoints.length >= 1) {
      const a = draftPoints[0]
      const b = draftPoints[draftPoints.length - 1] ?? a
      commitShapeNode(shapeKindFromTool(drawTool), a, b)
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

  const copySelection = useCallback(async () => {
    const selectedNodeIds = nodesRef.current.filter((node) => node.selected).map((node) => node.id)
    const selectedEdgeIds = edgesRef.current.filter((edge) => edge.selected).map((edge) => edge.id)
    const drawingIds = selectedDrawingIdRef.current ? [selectedDrawingIdRef.current] : []
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
    setSelectedDrawingId(cloned.drawings[0]?.id ?? null)
    return true
  }, [diagramPath, patchDocument])

  const cutSelection = useCallback(async () => {
    const selectedNodeIds = nodesRef.current.filter((node) => node.selected).map((node) => node.id)
    const selectedEdgeIds = edgesRef.current.filter((edge) => edge.selected).map((edge) => edge.id)
    const drawingIds = selectedDrawingIdRef.current ? [selectedDrawingIdRef.current] : []
    const copied = await copySelection()
    if (!copied) return false
    patchDocument((prev) =>
      removeSelectionFromView(prev, diagramPath, selectedNodeIds, drawingIds, selectedEdgeIds),
    )
    setSelectedDrawingId(null)
    onSelectionChange(null, null)
    return true
  }, [copySelection, diagramPath, onSelectionChange, patchDocument])

  const duplicateSelection = useCallback(async () => {
    const copied = await copySelection()
    if (!copied) return false
    return pasteClipboard()
  }, [copySelection, pasteClipboard])

  clipboardApiRef.current = {
    copySelection,
    cutSelection,
    pasteClipboard,
    duplicateSelection,
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const command = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      const hasSelection =
        nodesRef.current.some((node) => node.selected) ||
        edgesRef.current.some((edge) => edge.selected) ||
        Boolean(selectedDrawingIdRef.current)

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

      if (selectedDrawingId && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault()
        saveDrawings(drawings.filter((d) => d.id !== selectedDrawingId))
        setSelectedDrawingId(null)
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
    saveDrawings,
    selectedDrawingId,
  ])

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<IntegrationNodeData>>[]) => {
      const permittedChanges = layoutLocked
        ? changes.filter((change) => change.type !== 'position' && change.type !== 'dimensions')
        : changes
      onNodesChange(permittedChanges)
      const hasDimensionChange = permittedChanges.some((c) => c.type === 'dimensions')
      if (hasDimensionChange) {
        setNodes((current) => {
          syncDocument(current, edges)
          return current
        })
      }
    },
    [layoutLocked, onNodesChange, setNodes, syncDocument, edges],
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

  const onNodeDragStop = useCallback(() => {
    syncDocument(nodes, edges)
  }, [nodes, edges, syncDocument])

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
      if (isDrawMode) return
      if (selNodes[0] || selEdges[0]) setSelectedDrawingId(null)

      const node = (selNodes[0] as Node<IntegrationNodeData>) ?? null
      const edge = (selEdges[0] as Edge<IntegrationEdgeData>) ?? null

      // Node selection drives flow direction highlight on connectors
      if (node) {
        applyFlowFocus(node.id)
      } else if (edge) {
        applyFlowFocus(null, edge.id)
      } else {
        applyFlowFocus(null)
      }

      onSelectionChange(node, edge)
    },
    [applyFlowFocus, isDrawMode, onSelectionChange, setEdges],
  )

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (drawTool !== 'select') return
      const point = flowPoint(event)
      const hit = [...drawings].reverse().find((d) => hitTestDrawing(d, point))
      setSelectedDrawingId(hit?.id ?? null)
      if (hit) {
        applyFlowFocus(null)
        onSelectionChange(null, null)
      }
    },
    [applyFlowFocus, drawTool, drawings, flowPoint, onSelectionChange],
  )

  const selectedDrawing = selectedDrawingId
    ? drawings.find((drawing) => drawing.id === selectedDrawingId) ?? null
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
    <div className="canvas-wrapper" ref={reactFlowWrapper}>
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
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChangeHandler}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!isDrawMode && !layoutLocked}
        nodesConnectable={!isDrawMode && !layoutLocked}
        elementsSelectable={!isDrawMode}
        edgesReconnectable={!isDrawMode && !layoutLocked}
        reconnectRadius={18}
        connectionMode={ConnectionMode.Loose}
        panOnDrag={!isDrawMode}
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
        selectionKeyCode="Shift"
        defaultEdgeOptions={{ type: 'integration', reconnectable: true }}
        connectionLineComponent={IntegrationConnectionLine}
        deleteKeyCode={isDrawMode ? null : ['Backspace', 'Delete']}
        elevateNodesOnSelect={false}
        className={
          flowStyle.scope === 'touches' && (flowFocusId || flowEdgeId) ? 'flow-show-touches' : undefined
        }
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
        className={`drawing-overlay ${isDrawMode ? 'drawing-active' : ''}`}
        onMouseDown={handleOverlayMouseDown}
        onMouseMove={handleOverlayMouseMove}
        onMouseUp={handleOverlayMouseUp}
        onMouseLeave={handleOverlayMouseUp}
      >
        <svg className="drawing-svg">
          <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
            {drawings.map((el) => {
              const current = drawingOverride?.id === el.id ? drawingOverride : el
              const selected = el.id === selectedDrawingId
              const handleSize = 8 / Math.max(viewport.zoom, 0.2)
              const rect =
                current.type === 'rectangle' && current.points.length >= 2
                  ? rectFromPoints(current.points[0], current.points[1])
                  : null
              return (
                <g key={el.id}>
                  {renderDrawingElement(current, selected)}
                  {selected && rect && (
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
                          event.stopPropagation()
                          const point = flowPoint(event)
                          beginRectangleEdit({
                            kind: 'move',
                            id: el.id,
                            startPoint: point,
                            startPoints: current.points.map((p) => ({ ...p })),
                          })
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
            ? `Shape: ${SHAPE_TOOLS.find((t) => t.id === drawTool)?.label ?? 'Shape'} · Drag to size · Select mode to resize/connect`
            : drawTool === 'rectangle'
              ? 'Freehand rectangle · Drag to size · After placing, drag corners or edges to increase or decrease'
              : `Drawing mode: ${drawTool} · Click and drag · Select to edit components`
          : flowFocusId || flowEdgeId
            ? flowStyle.scope === 'chain'
              ? 'Showing the connected chain from this component · Unconnected boxes stay dim · Click empty canvas to clear'
              : flowStyle.scope === 'touches'
                ? 'All touches: every system this component connects to, with flow · Click empty canvas to clear'
                : 'Showing only boxes linked by an integration line · Click empty canvas to clear'
            : diagramPath.length === 0
              ? 'Select a box to highlight flow · Use All touches to see every connection'
              : 'Select a box to highlight connected integrations · Double-click to drill in'}
        {!isDrawMode && !flowFocusId && ' · Drag corners to resize · Drag ports to link · Shift-click to multi-select · Ctrl+C / Ctrl+V to copy paste'}
      </div>

      {propertiesPlacement === 'flyout' && selectionKey && !isDrawMode && !flyoutDismissed && (
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
      {propertiesPlacement === 'flyout' && selectionKey && !isDrawMode && flyoutDismissed && (
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
      {selectedDrawing && drawTool === 'select' && (
        <aside className="drawing-properties-flyout nodrag nopan">
          <div className="drawing-properties-header">
            <strong>{selectedDrawing.type === 'text' ? 'Text properties' : `${selectedDrawing.type} properties`}</strong>
            <button type="button" className="icon-btn" onClick={() => setSelectedDrawingId(null)} aria-label="Close drawing properties">×</button>
          </div>
          {selectedDrawing.type === 'text' && (
            <label>
              Text
              <input
                autoFocus
                value={selectedDrawing.text ?? ''}
                onChange={(event) => updateSelectedDrawing({ text: event.target.value })}
              />
            </label>
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
          {selectedDrawing.type === 'text' && (
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
              saveDrawings(drawings.filter((drawing) => drawing.id !== selectedDrawing.id))
              setSelectedDrawingId(null)
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
