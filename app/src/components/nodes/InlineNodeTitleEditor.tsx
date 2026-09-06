import { NodeToolbar, Position } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { useNodeTitleEdit } from './nodeTitleEditContext'

export function InlineNodeTitleEditor({ nodeId, label }: { nodeId: string; label: string }) {
  const { editingNodeId, finishEditing, cancelEditing } = useNodeTitleEdit()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(label)
  const active = editingNodeId === nodeId

  useEffect(() => {
    if (!active) return
    setDraft(label)
    window.requestAnimationFrame(() => inputRef.current?.select())
  }, [active, label])

  if (!active) return null

  const commit = () => finishEditing(nodeId, draft.trim() || label)

  return (
    <NodeToolbar isVisible position={Position.Top} offset={12} className="inline-node-title-editor nodrag nopan">
      <input
        ref={inputRef}
        value={draft}
        aria-label="Component name"
        onChange={(event) => setDraft(event.target.value)}
        onMouseDown={(event) => event.stopPropagation()}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            cancelEditing()
          }
        }}
      />
    </NodeToolbar>
  )
}
