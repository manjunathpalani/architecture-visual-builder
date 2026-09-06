import { Layers } from 'lucide-react'
import { useDrillIn } from './nodes/drillInContext'

interface SubDiagramBadgeProps {
  nodeId: string
  label: string
  systems?: number
  integrations?: number
  compact?: boolean
}

export function SubDiagramBadge({
  nodeId,
  label,
  systems = 0,
  integrations = 0,
  compact,
}: SubDiagramBadgeProps) {
  const onDrillInto = useDrillIn()
  const total = systems + integrations
  const title =
    total > 0
      ? `Open sub-design “${label}” (${systems} components, ${integrations} integrations)`
      : `Open sub-design “${label}”`

  return (
    <button
      type="button"
      className={`sub-diagram-open nodrag nopan ${compact ? 'compact' : ''}`}
      title={title}
      aria-label={title}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onDrillInto(nodeId, label)
      }}
    >
      <Layers size={compact ? 12 : 14} />
    </button>
  )
}
