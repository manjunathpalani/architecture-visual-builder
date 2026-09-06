import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { DIALOG_LABELS, type DialogId } from '../utils/dialogStack'

interface DialogLayerProps {
  id: DialogId
  stack: DialogId[]
  onClose: () => void
  children: ReactNode
}

export function DialogLayer({ id, stack, onClose, children }: DialogLayerProps) {
  const index = stack.indexOf(id)
  if (index < 0) return null
  const active = index === stack.length - 1
  const previous = active && index > 0 ? stack[index - 1] : null

  return (
    <div
      className={`dialog-layer ${active ? 'is-active' : 'is-buried'}`}
      style={{ zIndex: 200 + index }}
      aria-hidden={!active}
    >
      {previous && (
        <button type="button" className="dialog-back-btn" onClick={onClose}>
          <ChevronLeft size={16} />
          Back to {DIALOG_LABELS[previous]}
        </button>
      )}
      {children}
    </div>
  )
}
