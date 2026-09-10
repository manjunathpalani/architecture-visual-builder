import { Bot } from 'lucide-react'

export function ChangeDesignBadge({ compact }: { compact?: boolean }) {
  return (
    <span
      className={`change-design-badge ${compact ? 'compact' : ''}`}
      title="Has a coding-agent task in a technical change design"
    >
      <Bot size={compact ? 10 : 12} />
      {!compact && <span>Agent task</span>}
    </span>
  )
}
