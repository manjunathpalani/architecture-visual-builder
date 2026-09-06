import { Plus, X } from 'lucide-react'
import type { ProjectTab } from '../types/project'
import { EditableTabName } from './EditableTabName'

interface ProjectTabsProps {
  tabs: ProjectTab[]
  activeTabId: string
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onNewTab: () => void
  onRenameTab: (id: string, name: string) => void
}

export function ProjectTabs({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onRenameTab,
}: ProjectTabsProps) {
  return (
    <div className="project-tabs-bar">
      <div className="project-tabs-list">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          const name = tab.document.metadata.name || 'Untitled'
          const stats = `${tab.document.systems.length} · ${tab.document.integrations.length}`

          return (
            <div
              key={tab.id}
              className={`project-tab ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
              onKeyDown={(e) => e.key === 'Enter' && onSelectTab(tab.id)}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
            >
              <EditableTabName
                name={name}
                className="project-tab-name"
                onRename={(next) => onRenameTab(tab.id, next)}
              />
              <span className="project-tab-stats">{stats}</span>
              {tabs.length > 1 && (
                <button
                  type="button"
                  className="project-tab-close"
                  aria-label={`Close ${name}`}
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
                    onCloseTab(tab.id)
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>
      <button
        type="button"
        className="project-tab-new"
        title="New project tab"
        onClick={onNewTab}
      >
        <Plus size={16} />
      </button>
    </div>
  )
}