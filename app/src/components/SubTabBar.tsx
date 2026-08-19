import { LayoutTemplate, Plus } from 'lucide-react'
import type { DiagramPath } from '../types/diagram'
import type { SubTabItem } from '../utils/diagramNavigation'

interface SubTabBarProps {
  tabs: SubTabItem[]
  currentPath: DiagramPath
  onSelect: (path: DiagramPath) => void
  onNewFromTemplate: () => void
}

export function SubTabBar({ tabs, currentPath, onSelect, onNewFromTemplate }: SubTabBarProps) {
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
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`sub-tab ${isActive ? 'active' : ''} ${tab.kind}`}
              title={tab.name}
              onClick={() => onSelect(tab.path)}
            >
              <span className="sub-tab-name">{tab.name}</span>
              {stats && <span className="sub-tab-stats">{stats}</span>}
            </button>
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
