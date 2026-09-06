import { LayoutTemplate, Plus, X } from 'lucide-react'
import type { DiagramPath } from '../types/diagram'
import type { SubTabItem } from '../utils/diagramNavigation'
import { EditableTabName } from './EditableTabName'

interface SubTabBarProps {
  tabs: SubTabItem[]
  currentPath: DiagramPath
  onSelect: (path: DiagramPath) => void
  onNewFromTemplate: () => void
  onRemove: (tab: SubTabItem) => void
  onRename: (tab: SubTabItem, name: string) => void
}

export function SubTabBar({
  tabs,
  currentPath,
  onSelect,
  onNewFromTemplate,
  onRemove,
  onRename,
}: SubTabBarProps) {
  const activeId =
    currentPath.length === 0 ? 'overview' : currentPath[currentPath.length - 1].systemId

  return (
    <div className="sub-tabs-bar" role="tablist" aria-label="Sub-diagrams">
      <div className="sub-tabs-list">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId
          const stats =
            tab.stats != null ? `${tab.stats.systems} · ${tab.stats.integrations}` : ''
          return (
            <div
              key={tab.id}
              className={`sub-tab ${isActive ? 'active' : ''} ${tab.kind}`}
              role="tab"
              aria-selected={isActive}
              title={tab.name}
              onClick={() => onSelect(tab.path)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(tab.path)}
              tabIndex={0}
            >
              <EditableTabName
                name={tab.name}
                className="sub-tab-name"
                onRename={(next) => onRename(tab, next)}
              />
              {stats && <span className="sub-tab-stats">{stats}</span>}
              {tab.kind !== 'overview' && (
                <button
                  type="button"
                  className="sub-tab-close"
                  aria-label={`Close ${tab.name}`}
                  title="Close sub-tab"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onRemove(tab)
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )
        })}
      </div>
      <button
        type="button"
        className="sub-tab-new"
        title="New sub-tab from a template"
        onClick={onNewFromTemplate}
      >
        <Plus size={14} />
        <LayoutTemplate size={14} />
        <span>New sub-tab</span>
      </button>
    </div>
  )
}
