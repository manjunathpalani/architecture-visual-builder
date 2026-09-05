import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
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
import { Sparkles } from 'lucide-react'
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
import { DrawingToolbar, SHAPE_TOOLS } from './DrawingToolbar'
import { LayoutToolbar } from './LayoutToolbar'
import { getMinimapColor } from '../utils/nodeStyle'
import { captureReactFlowPng, type DiagramImage } from '../utils/captureDiagram'
import {
  loadFlowStyle,
  saveFlowStyle,
  traceEndToEnd,
  type FlowStyle,
  type FlowTrace,
} from '../utils/flowTrace'
import {
  loadArchitectureStateView,
  saveArchitectureStateView,
  type ArchitectureStateView,
} from '../utils/architectureState'
import { loadCanvasSideCollapsed, saveCanvasSideCollapsed } from '../utils/canvasDocks'
import { EdgeEditContext } from './edges/edgeEdit'

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

interface IntegrationCanvasProps {
  document: ArchitectureDocument
  diagramPath: DiagramPath
  onDocumentChange: (doc: ArchitectureDocument) => void
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
  const { screenToFlowPosition, getNode, getNodes, setCenter, setNodes: setFlowNodes, fitView } = useReactFlow()
  const viewport = useViewport()
  const nodesInitialized = useNodesInitialized()
  const didFitRef = useRef(false)

  const diagramView = getDiagramView(document, diagramPath)
  const drawings = diagramView.drawings

  useImperativeHandle(ref, () => ({
    capturePng: () => captureReactFlowPng(getNodes()),
  }), [getNodes])

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

  const initial = documentToFlowAtPath(document, diagramPath, stateView)
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)

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
    const useE2e = style.endToEnd && Boolean(selectedId || selectedEdgeId)
    const trace = useE2e ? traceEndToEnd(currentEdges, labels, selectedId, selectedEdgeId) : null
    setFlowTrace(selectedId || selectedEdgeId ? trace : null)

    const neighborIds = new Set<string>()
    if (selectedId) {
      currentEdges.forEach((e) => {
        if (e.source === selectedId) neighborIds.add(e.target)
        if (e.target === selectedId) neighborIds.add(e.source)
      })
    }

    setNodes((nds) => {
      let changed = false
      const next = nds.map((n) => {
        const isFlowFocus = selectedId != null && n.id === selectedId
        const isFlowNeighbor = selectedId != null && neighborIds.has(n.id)
        const isFlowPath = Boolean(trace?.nodeIds.has(n.id) && n.id !== selectedId)
        if (
          n.data.isFlowFocus === isFlowFocus &&
          n.data.isFlowNeighbor === isFlowNeighbor &&
          n.data.isFlowPath === isFlowPath
        ) {
          return n
        }
        changed = true
        return {
          ...n,
          data: { ...n.data, isFlowFocus, isFlowNeighbor, isFlowPath },
        }
      })
      return changed ? next : nds
    })

    setEdges((eds) => {
      let changed = false
      const next = eds.map((edge) => {
        let focusRelation: EdgeFocusRelation = 'idle'
        if (selectedId || selectedEdgeId) {
          const hop = trace?.edgeHop.get(edge.id)
          if (hop) focusRelation = hop
          else if (!useE2e && selectedId) {
            if (edge.source === selectedId) focusRelation = 'out'
            else if (edge.target === selectedId) focusRelation = 'in'
            else focusRelation = 'unrelated'
          } else {
            focusRelation = 'unrelated'
          }
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
  }, [applyFlowFocus, flowStyle.colorBy, flowStyle.endToEnd])

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
      onDocumentChange(updateDrawingsAtPath(document, diagramPath, next))
    },
    [document, diagramPath, onDocumentChange],
  )

  const syncDocument = useCallback(
    (nextNodes: Node<IntegrationNodeData>[], nextEdges: Edge<IntegrationEdgeData>[]) => {
      onDocumentChange(syncFlowToDocument(document, diagramPath, nextNodes, nextEdges))
    },
    [document, diagramPath, onDocumentChange],
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (selectedDrawingId && (event.key === 'Delete' || event.key === 'Backspace')) {
        const tag = (event.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        saveDrawings(drawings.filter((d) => d.id !== selectedDrawingId))
        setSelectedDrawingId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawings, saveDrawings, selectedDrawingId])

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<IntegrationNodeData>>[]) => {
      onNodesChange(changes)
      const hasDimensionChange = changes.some((c) => c.type === 'dimensions')
      if (hasDimensionChange) {
        setNodes((current) => {
          syncDocument(current, edges)
          return current
        })
      }
    },
    [onNodesChange, setNodes, syncDocument, edges],
  )

  const updateEdgeGeometry = useCallback(
    (edgeId: string, patch: Partial<IntegrationEdgeData>) => {
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
    [setEdges, syncDocument],
  )

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (isDrawMode) return
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
    [isDrawMode, setEdges, syncDocument],
  )

  const onReconnect = useCallback(
    (oldEdge: Edge<IntegrationEdgeData>, newConnection: Connection) => {
      if (isDrawMode) return
      setEdges((eds) => {
        const updated = reconnectEdge<Edge<IntegrationEdgeData>>(oldEdge, newConnection, eds)
        syncDocument(nodesRef.current, updated)
        return updated
      })
    },
    [isDrawMode, setEdges, syncDocument],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (isDrawMode) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [isDrawMode])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (isDrawMode) return
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
    [edges, isDrawMode, screenToFlowPosition, setNodes, syncDocument],
  )

  const onNodeDragStop = useCallback(() => {
    syncDocument(nodes, edges)
  }, [nodes, edges, syncDocument])

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
        nodesDraggable={!isDrawMode}
        nodesConnectable={!isDrawMode}
        elementsSelectable={!isDrawMode}
        edgesReconnectable={!isDrawMode}
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
        defaultEdgeOptions={{ type: 'integration', reconnectable: true }}
        connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2 }}
        deleteKeyCode={isDrawMode ? null : ['Backspace', 'Delete']}
        elevateNodesOnSelect={false}
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
      <LayoutToolbar onLayoutApplied={syncDocument} />

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
            ? flowStyle.endToEnd
              ? 'Selection traces the full start-to-end integration path · Click empty canvas to clear'
              : 'Box selected · Green = downstream · Blue = upstream · Click empty canvas to clear'
            : diagramPath.length === 0
              ? 'Select a box or connector to highlight the end-to-end integration flow'
              : 'Select a box to highlight the end-to-end flow · Double-click to drill in'}
        {!isDrawMode && !flowFocusId && ' · Drag corners to resize · Drag ports to link · Drag connector ends to move them'}
      </div>
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
        properties={properties}
        selectionKey={selectionKey}
        onExpand={expandSidePanel}
      />
    </div>
  )
})

IntegrationCanvas.displayName = 'IntegrationCanvas'