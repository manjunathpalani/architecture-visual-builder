import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Pause,
  Play,
  SlidersHorizontal,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { ArchitectureStateView } from '../utils/architectureState'
import {
  clampPanelWidth,
  loadToolsPanelWidth,
  saveToolsPanelWidth,
  TOOLS_PANEL_WIDTH,
  type PropertiesPlacement,
} from '../utils/canvasDocks'
import type { FlowColorBy, FlowScope, FlowStyle, FlowTrace } from '../utils/flowTrace'
import { ArchitectureLegendItems, ArchitectureStateButtons } from './ArchitectureStateLegend'

const SECTION_IDS = [
  'view',
  'flow',
  'state',
  'legend',
  'properties',
] as const

type SectionId = (typeof SECTION_IDS)[number]

const SECTION_LABELS: Record<SectionId, string> = {
  view: 'View',
  flow: 'Flow',
  state: 'Architecture state',
  legend: 'Legend',
  properties: 'Properties',
}

const DEFAULT_OPEN: SectionId[] = ['view', 'flow', 'properties']
const EXPANDED_STORAGE_KEY = 'avb-tools-expanded-sections'

function loadExpandedSections(): Set<SectionId> {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      return new Set(parsed.filter((id): id is SectionId => SECTION_IDS.includes(id as SectionId)))
    }
  } catch {
    /* ignore */
  }
  return new Set(DEFAULT_OPEN)
}

function PanelSection({
  id,
  count,
  highlight,
  expanded,
  onToggle,
  children,
}: {
  id: SectionId
  count?: number | string
  highlight?: boolean
  expanded: boolean
  onToggle: (id: SectionId) => void
  children: ReactNode
}) {
  return (
    <div className={`palette-group ${expanded ? 'open' : 'collapsed'}${highlight ? ' highlight' : ''}`}>
      <button
        type="button"
        className="palette-group-header"
        onClick={() => onToggle(id)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown size={14} className="palette-chevron" />
        ) : (
          <ChevronRight size={14} className="palette-chevron" />
        )}
        <span className="palette-group-title">{SECTION_LABELS[id]}</span>
        {count != null && <span className="palette-group-count">{count}</span>}
      </button>
      {expanded && <div className="tools-group-body">{children}</div>}
    </div>
  )
}

interface CanvasSidePanelProps {
  collapsed: boolean
  onToggle: () => void
  isFullscreen: boolean
  menusHidden: boolean
  onToggleFullscreen?: () => void
  onToggleMenus?: () => void
  flowStyle: FlowStyle
  onFlowStyle: (patch: Partial<FlowStyle>) => void
  flowFocusId: string | null
  flowEdgeId: string | null
  flowTrace: FlowTrace | null
  highlightedPathId?: string | null
  onHighlightPath?: (pathId: string | null) => void
  isPlayingFlow?: boolean
  playHopIndex?: number
  onPlayFlow?: () => void
  onStopFlow?: () => void
  stateView: ArchitectureStateView
  onStateView: (view: ArchitectureStateView) => void
  properties?: ReactNode
  propertiesPlacement?: PropertiesPlacement
  onPropertiesPlacement?: (placement: PropertiesPlacement) => void
  selectionKey?: string | null
  onExpand?: () => void
}

export function CanvasSidePanel({
  collapsed,
  onToggle,
  isFullscreen,
  menusHidden,
  onToggleFullscreen,
  onToggleMenus,
  flowStyle,
  onFlowStyle,
  flowFocusId,
  flowEdgeId,
  flowTrace,
  highlightedPathId,
  onHighlightPath,
  isPlayingFlow,
  playHopIndex = -1,
  onPlayFlow,
  onStopFlow,
  stateView,
  onStateView,
  properties,
  propertiesPlacement = 'side',
  onPropertiesPlacement,
  selectionKey = null,
  onExpand,
}: CanvasSidePanelProps) {
  const open = !collapsed
  const hasSelection = Boolean(selectionKey)
  const [expanded, setExpanded] = useState<Set<SectionId>>(loadExpandedSections)
  const [panelWidth, setPanelWidth] = useState(loadToolsPanelWidth)
  const [resizing, setResizing] = useState(false)
  const propertiesRef = useRef<HTMLDivElement>(null)
  const onExpandRef = useRef(onExpand)
  onExpandRef.current = onExpand

  useEffect(() => {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...expanded]))
  }, [expanded])

  useEffect(() => {
    if (!selectionKey) return
    onExpandRef.current?.()
    setExpanded((prev) => {
      if (prev.has('properties')) return prev
      const next = new Set(prev)
      next.add('properties')
      return next
    })
    window.requestAnimationFrame(() => {
      propertiesRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [selectionKey])

  const toggleSection = useCallback((id: SectionId) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpanded(new Set(SECTION_IDS))
  }, [])

  const collapseAll = useCallback(() => {
    setExpanded(new Set())
  }, [])

  const allExpanded = expanded.size === SECTION_IDS.length
  const allCollapsed = expanded.size === 0

  const startResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!open) return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    const startX = event.clientX
    const startWidth = panelWidth
    handle.setPointerCapture(event.pointerId)
    setResizing(true)
    document.body.classList.add('is-panel-resizing')

    const onMove = (move: PointerEvent) => {
      const next = clampPanelWidth(
        startWidth - (move.clientX - startX),
        TOOLS_PANEL_WIDTH.min,
        TOOLS_PANEL_WIDTH.max,
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
        saveToolsPanelWidth(current)
        return current
      })
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  }, [open, panelWidth])

  return (
    <div
      className={`tools-shell ${open ? 'open' : 'closed'}${resizing ? ' is-resizing' : ''}`}
      style={{ '--tools-width': `${panelWidth}px` } as CSSProperties}
    >
      {open && (
        <div
          className="panel-resize-handle panel-resize-handle-left"
          onPointerDown={startResize}
          title="Drag to resize"
        />
      )}
      <aside className="tools-panel" aria-hidden={!open} id="canvas-tools-panel">
        <div className="panel-header palette-panel-header">
          <div>
            <h2>Tools</h2>
            <p>Options and properties</p>
          </div>
          <div className="palette-expand-actions">
            <button
              type="button"
              className="palette-expand-btn"
              title="Expand all sections"
              disabled={allExpanded}
              onClick={expandAll}
            >
              <ChevronsUpDown size={14} />
            </button>
            <button
              type="button"
              className="palette-expand-btn"
              title="Collapse all sections"
              disabled={allCollapsed}
              onClick={collapseAll}
            >
              <ChevronsDownUp size={14} />
            </button>
            <button
              type="button"
              className="palette-expand-btn"
              title="Hide tools panel"
              onClick={onToggle}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="palette-groups">
          <PanelSection id="view" expanded={expanded.has('view')} onToggle={toggleSection}>
            <div className="canvas-side-tools">
              {onToggleMenus && (
                <button
                  type="button"
                  className={`flow-color-btn ${menusHidden ? 'active' : ''}`}
                  onClick={onToggleMenus}
                >
                  {menusHidden ? 'Show menus' : 'Hide menus'}
                </button>
              )}
              {onToggleFullscreen && (
                <button
                  type="button"
                  className={`flow-color-btn ${isFullscreen ? 'active' : ''}`}
                  onClick={onToggleFullscreen}
                >
                  {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                </button>
              )}
            </div>
            {onPropertiesPlacement && (
              <>
                <p className="flow-scope-label">Properties</p>
                <div className="canvas-side-tools">
                  <button
                    type="button"
                    className={`flow-color-btn ${propertiesPlacement === 'side' ? 'active' : ''}`}
                    onClick={() => onPropertiesPlacement('side')}
                  >
                    Side panel
                  </button>
                  <button
                    type="button"
                    className={`flow-color-btn ${propertiesPlacement === 'flyout' ? 'active' : ''}`}
                    onClick={() => onPropertiesPlacement('flyout')}
                  >
                    Next to component
                  </button>
                </div>
              </>
            )}
          </PanelSection>

          <PanelSection id="flow" expanded={expanded.has('flow')} onToggle={toggleSection}>
            <p className="flow-scope-label">Line color</p>
            <div className="canvas-side-tools">
              {(['direction', 'protocol', 'custom', 'path'] as FlowColorBy[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`flow-color-btn ${flowStyle.colorBy === mode ? 'active' : ''}`}
                  title={
                    mode === 'direction'
                      ? 'Color lines by arrow direction'
                      : mode === 'protocol'
                        ? 'Color lines by protocol'
                        : mode === 'custom'
                          ? 'Use each line’s own color from Properties'
                          : 'Color each traced path differently'
                  }
                  onClick={() => onFlowStyle({ colorBy: mode })}
                >
                  {mode === 'direction'
                    ? 'Direction'
                    : mode === 'protocol'
                      ? 'Protocol'
                      : mode === 'custom'
                        ? 'Line color'
                        : 'Path'}
                </button>
              ))}
            </div>
            <p className="flow-scope-label">When a component is selected</p>
            <div className="canvas-side-tools">
              {([
                { id: 'direct', label: 'Direct links', title: 'Only boxes with a line to the selected component' },
                {
                  id: 'touches',
                  label: 'All touches',
                  title: 'Every system the selected component connects to, with flow and touch points',
                },
                { id: 'chain', label: 'End to end', title: 'Follow the connected integration chain from start to finish' },
              ] as Array<{ id: FlowScope; label: string; title: string }>).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.title}
                  className={`flow-color-btn ${(flowStyle.scope ?? 'direct') === item.id ? 'active' : ''}`}
                  onClick={() => onFlowStyle({ scope: item.id, endToEnd: item.id === 'chain' })}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {(flowFocusId || flowEdgeId) && (
              <div className="canvas-side-tools flow-play-row">
                <button
                  type="button"
                  className={`flow-color-btn ${isPlayingFlow ? 'active' : ''}`}
                  disabled={!onPlayFlow}
                  title="Animate the connected chain hop by hop"
                  onClick={() => (isPlayingFlow ? onStopFlow?.() : onPlayFlow?.())}
                >
                  {isPlayingFlow ? <Pause size={12} /> : <Play size={12} />}
                  {isPlayingFlow ? 'Stop flow' : 'Play flow'}
                </button>
              </div>
            )}
            {(flowFocusId || flowEdgeId) && (
              <div className="flow-legend">
                <span className="flow-legend-title">
                  {flowStyle.scope === 'chain'
                    ? 'End-to-end paths'
                    : flowStyle.scope === 'touches'
                      ? `All touches (${flowTrace?.directNodeIds.size ?? 0})`
                      : 'Direct connections'}
                </span>
                {flowStyle.scope !== 'direct' && flowTrace && flowTrace.paths.length > 0 ? (
                  flowTrace.paths.slice(0, 8).map((path) => (
                    <button
                      key={path.id}
                      type="button"
                      className={`flow-path-chip ${highlightedPathId === path.id ? 'active' : ''} ${
                        isPlayingFlow && highlightedPathId === path.id ? 'playing' : ''
                      }`}
                      title={`${path.labels.join(' → ')}${onHighlightPath ? ' · Click to isolate this flow' : ''}`}
                      onClick={() =>
                        onHighlightPath?.(highlightedPathId === path.id ? null : path.id)
                      }
                    >
                      <i style={{ background: path.color }} />
                      {path.labels.join(' → ')}
                      {isPlayingFlow && highlightedPathId === path.id && playHopIndex >= 0
                        ? ` · ${playHopIndex + 1}/${path.edgeIds.length}`
                        : ''}
                    </button>
                  ))
                ) : (
                  <>
                    <span className="flow-legend-item out">
                      <i /> Downstream
                    </span>
                    <span className="flow-legend-item in">
                      <i /> Upstream
                    </span>
                  </>
                )}
                {flowStyle.scope !== 'direct' && flowTrace && flowTrace.paths.length > 8 && (
                  <span className="flow-legend-item dim">+{flowTrace.paths.length - 8} more</span>
                )}
                <span className="flow-legend-item dim">
                  {highlightedPathId
                    ? 'Showing one path · click again to show all'
                    : 'Shift-click a second box to trace start → end · other links dimmed'}
                </span>
              </div>
            )}
          </PanelSection>

          <PanelSection id="state" expanded={expanded.has('state')} onToggle={toggleSection}>
            <ArchitectureStateButtons view={stateView} onChangeView={onStateView} />
          </PanelSection>

          <PanelSection id="legend" expanded={expanded.has('legend')} onToggle={toggleSection}>
            <ArchitectureLegendItems />
          </PanelSection>

          <div ref={propertiesRef}>
            <PanelSection
              id="properties"
              count={hasSelection ? 1 : 0}
              highlight={hasSelection}
              expanded={expanded.has('properties')}
              onToggle={toggleSection}
            >
              <div className="canvas-side-properties visible">
                {propertiesPlacement === 'flyout' ? (
                  <p className="code-link-hint">
                    Properties open next to the selected component. Choose Side panel to dock them here.
                  </p>
                ) : (
                  properties
                )}
              </div>
            </PanelSection>
          </div>
        </div>
      </aside>

      <button
        type="button"
        className={`tools-holder ${hasSelection ? 'has-selection' : ''}`}
        onClick={onToggle}
        title={open ? 'Hide tools panel' : 'Show tools panel'}
        aria-expanded={open}
        aria-controls="canvas-tools-panel"
      >
        <span className="palette-holder-grip" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <SlidersHorizontal size={14} className="palette-holder-icon" />
        <span className="palette-holder-label">{open ? 'Hide' : 'Tools'}</span>
        {open ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </div>
  )
}
