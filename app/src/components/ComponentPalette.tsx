import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  LayoutGrid,
} from 'lucide-react'
import { PALETTE_CATEGORY_ORDER, PALETTE_ITEMS, SYSTEM_TYPE_CONFIG, type PaletteItem } from '../types'
import { ServiceIcon } from './icons/ServiceIcons'

const STORAGE_KEY = 'palette-expanded-categories'
const OPEN_STORAGE_KEY = 'palette-panel-open'

interface ComponentPaletteProps {
  onDragStart: (event: React.DragEvent, item: PaletteItem) => void
}

function loadExpandedCategories(categories: string[]): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      return new Set(parsed.filter((c) => categories.includes(c)))
    }
  } catch {
    /* ignore */
  }
  return new Set(categories)
}

function loadPanelOpen(): boolean {
  try {
    const raw = localStorage.getItem(OPEN_STORAGE_KEY)
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {
    /* ignore */
  }
  return true
}

export function ComponentPalette({ onDragStart }: ComponentPaletteProps) {
  const grouped = useMemo(
    () =>
      PALETTE_ITEMS.reduce<Record<string, PaletteItem[]>>((acc, item) => {
        if (!acc[item.category]) acc[item.category] = []
        acc[item.category].push(item)
        return acc
      }, {}),
    [],
  )

  const visibleCategories = useMemo(
    () => PALETTE_CATEGORY_ORDER.filter((cat) => grouped[cat]),
    [grouped],
  )

  const [open, setOpen] = useState(loadPanelOpen)
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    loadExpandedCategories(visibleCategories),
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...expanded]))
  }, [expanded])

  useEffect(() => {
    localStorage.setItem(OPEN_STORAGE_KEY, open ? '1' : '0')
  }, [open])

  const togglePanel = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const toggleCategory = useCallback((category: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpanded(new Set(visibleCategories))
  }, [visibleCategories])

  const collapseAll = useCallback(() => {
    setExpanded(new Set())
  }, [])

  const allExpanded = expanded.size === visibleCategories.length
  const allCollapsed = expanded.size === 0

  return (
    <div className={`palette-shell ${open ? 'open' : 'closed'}`}>
      <aside
        className="palette"
        aria-hidden={!open}
        id="component-palette-panel"
      >
        <div className="panel-header palette-panel-header">
          <div>
            <h2>Components</h2>
            <p>Drag onto canvas</p>
          </div>
          <div className="palette-expand-actions">
            <button
              type="button"
              className="palette-expand-btn"
              title="Expand all groups"
              disabled={allExpanded}
              onClick={expandAll}
            >
              <ChevronsUpDown size={14} />
            </button>
            <button
              type="button"
              className="palette-expand-btn"
              title="Collapse all groups"
              disabled={allCollapsed}
              onClick={collapseAll}
            >
              <ChevronsDownUp size={14} />
            </button>
            <button
              type="button"
              className="palette-expand-btn"
              title="Close components panel"
              onClick={togglePanel}
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        </div>
        <div className="palette-groups">
          {visibleCategories.map((category) => {
            const isOpen = expanded.has(category)
            const count = grouped[category].length

            return (
              <div key={category} className={`palette-group ${isOpen ? 'open' : 'collapsed'}`}>
                <button
                  type="button"
                  className="palette-group-header"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown size={14} className="palette-chevron" />
                  ) : (
                    <ChevronRight size={14} className="palette-chevron" />
                  )}
                  <span className="palette-group-title">{category}</span>
                  <span className="palette-group-count">{count}</span>
                </button>
                {isOpen && (
                  <div className="palette-items">
                    {grouped[category].map((item) => {
                      const config = SYSTEM_TYPE_CONFIG[item.type]
                      const service = item.defaultProperties?.service
                      const vendor = item.defaultProperties?.vendor
                      const paletteIcon = service ? (
                        <ServiceIcon vendor={vendor} service={service} size={18} />
                      ) : (
                        <span className="palette-icon">{config.icon}</span>
                      )

                      return (
                        <div
                          key={`${item.type}-${item.label}`}
                          className="palette-item"
                          draggable
                          onDragStart={(e) => onDragStart(e, item)}
                          style={{ '--item-color': config.color } as React.CSSProperties}
                        >
                          {paletteIcon}
                          <span className="palette-label">{item.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </aside>

      <button
        type="button"
        className="palette-holder"
        onClick={togglePanel}
        title={open ? 'Close components panel' : 'Open components panel'}
        aria-expanded={open}
        aria-controls="component-palette-panel"
      >
        <span className="palette-holder-grip" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <LayoutGrid size={14} className="palette-holder-icon" />
        <span className="palette-holder-label">{open ? 'Hide' : 'Components'}</span>
        {open ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
    </div>
  )
}
