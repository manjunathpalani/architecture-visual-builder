import { ChevronRight, Folder, FolderOpen, Layers } from 'lucide-react'
import type { DiagramPath } from '../types/diagram'
import { EditableTabName } from './EditableTabName'

interface DiagramBreadcrumbProps {
  documentName: string
  drillPath: DiagramPath
  levelLabel?: string
  onNavigate: (depth: number) => void
  onRename: (depth: number, name: string) => void
}

export function DiagramBreadcrumb({
  documentName,
  drillPath,
  levelLabel,
  onNavigate,
  onRename,
}: DiagramBreadcrumbProps) {
  return (
    <nav className="diagram-breadcrumb" aria-label="Diagram folder path">
      <span
        className={`breadcrumb-item folder ${drillPath.length === 0 ? 'active' : ''}`}
        onClick={() => onNavigate(0)}
        title="Open root diagram"
      >
        <span className="breadcrumb-folder-btn">
          {drillPath.length === 0 ? <FolderOpen size={14} /> : <Folder size={14} />}
        </span>
        <EditableTabName
          name={documentName}
          className="breadcrumb-folder-name"
          title="Open or rename the root diagram"
          onRename={(name) => onRename(0, name)}
        />
      </span>

      {drillPath.map((segment, index) => {
        const isLast = index === drillPath.length - 1
        return (
          <span key={`${segment.systemId}-${index}`} className="breadcrumb-segment">
            <ChevronRight size={14} className="breadcrumb-chevron" />
            <span
              className={`breadcrumb-item folder ${isLast ? 'active' : ''}`}
              onClick={() => onNavigate(index + 1)}
              title={`Open ${segment.label}`}
            >
              <span className="breadcrumb-folder-btn">
                {isLast ? <FolderOpen size={14} /> : <Folder size={14} />}
              </span>
              <EditableTabName
                name={segment.label}
                className="breadcrumb-folder-name"
                title="Open or rename this diagram folder"
                onRename={(name) => onRename(index + 1, name)}
              />
            </span>
          </span>
        )
      })}

      {drillPath.length > 0 && (
        <button
          type="button"
          className="breadcrumb-detail-badge"
          onClick={() => onNavigate(0)}
          title="Back to root diagram"
        >
          <Layers size={12} />
          Detail view{levelLabel ? `: ${levelLabel}` : ''} · click for root
        </button>
      )}
    </nav>
  )
}