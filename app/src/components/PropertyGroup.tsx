import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'

const STORAGE_KEY = 'avb-property-groups-v2'

export type PropertyGroupId =
  | 'identity'
  | 'details'
  | 'appearance'
  | 'state'
  | 'links'
  | 'feature'
  | 'structure'
  | 'line'
  | 'sequence'
  | 'notes'
  | 'infra'
  | 'nfr'
  | 'spec'

export const SYSTEM_PROPERTY_GROUPS: PropertyGroupId[] = [
  'identity',
  'details',
  'appearance',
  'state',
  'feature',
  'links',
  'structure',
  'notes',
  'infra',
  'nfr',
]

export const EDGE_PROPERTY_GROUPS: PropertyGroupId[] = ['identity', 'line', 'sequence', 'notes', 'spec']

const DEFAULT_OPEN: PropertyGroupId[] = ['identity', 'line', 'state', 'feature']

function loadOpenGroups(): Set<PropertyGroupId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set(DEFAULT_OPEN)
    const parsed = JSON.parse(raw) as string[]
    if (!Array.isArray(parsed)) return new Set(DEFAULT_OPEN)
    return new Set(parsed.filter((id): id is PropertyGroupId => typeof id === 'string'))
  } catch {
    return new Set(DEFAULT_OPEN)
  }
}

export function usePropertyGroups() {
  const [open, setOpen] = useState<Set<PropertyGroupId>>(loadOpenGroups)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...open]))
    } catch {
      /* ignore */
    }
  }, [open])

  const isOpen = useCallback((id: PropertyGroupId) => open.has(id), [open])

  const toggle = useCallback((id: PropertyGroupId) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback((ids: PropertyGroupId[]) => {
    setOpen(new Set(ids))
  }, [])

  const mergeAll = useCallback(() => {
    setOpen(new Set())
  }, [])

  return { isOpen, toggle, expandAll, mergeAll }
}

export function PropertyGroupToolbar({
  onExpandAll,
  onMergeAll,
}: {
  onExpandAll: () => void
  onMergeAll: () => void
}) {
  return (
    <div className="property-group-toolbar">
      <button type="button" className="btn-secondary property-group-tool" onClick={onExpandAll}>
        <ChevronsUpDown size={13} />
        Expand
      </button>
      <button type="button" className="btn-secondary property-group-tool" onClick={onMergeAll}>
        <ChevronsDownUp size={13} />
        Merge
      </button>
    </div>
  )
}

export function PropertyGroup({
  id,
  title,
  summary,
  expanded,
  onToggle,
  children,
}: {
  id: PropertyGroupId
  title: string
  summary?: string
  expanded: boolean
  onToggle: (id: PropertyGroupId) => void
  children: ReactNode
}) {
  return (
    <div className={`property-group ${expanded ? 'open' : 'collapsed'}`}>
      <button
        type="button"
        className="property-group-header"
        onClick={() => onToggle(id)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown size={14} className="palette-chevron" />
        ) : (
          <ChevronRight size={14} className="palette-chevron" />
        )}
        <span className="property-group-title">{title}</span>
        {!expanded && summary ? <span className="property-group-summary">{summary}</span> : null}
      </button>
      {expanded && <div className="property-group-body">{children}</div>}
    </div>
  )
}
