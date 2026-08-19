import { ZoomIn } from 'lucide-react'

interface SubDiagramBadgeProps {
  systems: number
  integrations: number
  compact?: boolean
}

export function SubDiagramBadge({ systems, integrations, compact }: SubDiagramBadgeProps) {
  const total = systems + integrations
  if (total === 0) return null

  const label =
    systems > 0 && integrations > 0
      ? `${systems} · ${integrations}↔`
      : systems > 0
        ? `${systems} inside`
        : `${integrations} links`

  return (
    <span
      className={`sub-diagram-badge ${compact ? 'compact' : ''}`}
      title={`Double-click to open sub-diagram (${systems} components, ${integrations} integrations)`}
    >
      <ZoomIn size={compact ? 10 : 12} />
      {label}
    </span>
  )
}