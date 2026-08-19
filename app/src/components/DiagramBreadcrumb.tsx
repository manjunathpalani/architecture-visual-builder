import { ChevronRight, Home, Layers } from 'lucide-react'
import type { DiagramPath } from '../types/diagram'

interface DiagramBreadcrumbProps {
  documentName: string
  drillPath: DiagramPath
  levelLabel?: string
  onNavigate: (depth: number) => void
}

export function DiagramBreadcrumb({
  documentName,
  drillPath,
  levelLabel,
  onNavigate,
}: DiagramBreadcrumbProps) {
  return (
    <nav className="diagram-breadcrumb" aria-label="Diagram navigation">
      <button
        type="button"
        className={`breadcrumb-item ${drillPath.length === 0 ? 'active' : ''}`}
        onClick={() => onNavigate(0)}
        title="Overview"
      >
        <Home size={14} />
        <span>{documentName}</span>
      </button>

      {drillPath.map((segment, index) => {
        const isLast = index === drillPath.length - 1
        return (
          <span key={`${segment.systemId}-${index}`} className="breadcrumb-segment">
            <ChevronRight size={14} className="breadcrumb-chevron" />
            <button
              type="button"
              className={`breadcrumb-item ${isLast ? 'active' : ''}`}
              onClick={() => onNavigate(index + 1)}
              title={segment.label}
            >
              {segment.label}
            </button>
          </span>
        )
      })}

      {drillPath.length > 0 && (
        <span className="breadcrumb-detail-badge">
          <Layers size={12} />
          Detail view{levelLabel ? `: ${levelLabel}` : ''}
        </span>
      )}
    </nav>
  )
}