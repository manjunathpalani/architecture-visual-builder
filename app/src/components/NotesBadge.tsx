import { StickyNote, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { hasRichNotes, renderRichNotes } from '../utils/richNotes'

interface NotesBadgeProps {
  notes?: string | null
  compact?: boolean
  title?: string
}

export function NotesBadge({ notes, compact, title = 'Notes' }: NotesBadgeProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const visible = hasRichNotes(notes)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  if (!visible) return null

  return (
    <div className={`notes-badge-wrap ${compact ? 'compact' : ''}`} ref={ref}>
      <button
        type="button"
        className={`notes-badge nodrag nopan ${compact ? 'compact' : ''}`}
        title="View notes"
        aria-label="View notes"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <StickyNote size={compact ? 11 : 13} />
        {!compact && <span>Notes</span>}
      </button>
      {open && (
        <div
          className="notes-popover nodrag nopan nowheel"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="notes-popover-header">
            <strong>{title}</strong>
            <button type="button" className="icon-btn" aria-label="Close notes" onClick={() => setOpen(false)}>
              <X size={12} />
            </button>
          </div>
          <div className="rich-notes-preview" dangerouslySetInnerHTML={{ __html: renderRichNotes(notes ?? '') }} />
        </div>
      )}
    </div>
  )
}
