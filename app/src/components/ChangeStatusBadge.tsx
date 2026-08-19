import {
  CHANGE_STATUS_COLORS,
  CHANGE_STATUS_LABELS,
  parseChangeStatus,
  type ChangeStatus,
} from '../utils/architectureState'

export function ChangeStatusBadge({
  status,
  compact,
}: {
  status?: string
  compact?: boolean
}) {
  const value: ChangeStatus = parseChangeStatus(status)
  if (value === 'unchanged') return null
  return (
    <span
      className={`change-status-badge change-${value} ${compact ? 'compact' : ''}`}
      style={{ background: CHANGE_STATUS_COLORS[value] }}
      title={CHANGE_STATUS_LABELS[value]}
    >
      {value === 'new' ? 'Future' : value === 'modified' ? 'Changed' : 'Retired'}
    </span>
  )
}
