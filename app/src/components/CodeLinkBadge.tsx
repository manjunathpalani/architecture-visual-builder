import { GitBranch } from 'lucide-react'
import type { SystemProperties } from '../types'
import { buildBrowseUrl, getCodeLinkLabel, hasCodeLink } from '../utils/codeLink'

interface CodeLinkBadgeProps {
  properties: SystemProperties
  compact?: boolean
}

export function CodeLinkBadge({ properties, compact }: CodeLinkBadgeProps) {
  if (!hasCodeLink(properties)) return null

  const label = getCodeLinkLabel(properties)
  const url = buildBrowseUrl(properties)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      className={`code-link-badge ${compact ? 'compact' : ''}`}
      title={url ? `Open in repository: ${url}` : label}
      onClick={handleClick}
    >
      <GitBranch size={compact ? 10 : 12} />
      {!compact && <span>{label}</span>}
    </button>
  )
}