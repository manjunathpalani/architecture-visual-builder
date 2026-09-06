import { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'

interface EditableTabNameProps {
  name: string
  title?: string
  className?: string
  editable?: boolean
  onRename: (name: string) => void
}

export function EditableTabName({
  name,
  title,
  className,
  editable = true,
  onRename,
}: EditableTabNameProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(name)
  }, [editing, name])

  useEffect(() => {
    if (!editing) return
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [editing])

  const commit = () => {
    const next = draft.trim()
    setEditing(false)
    if (!next || next === name) {
      setDraft(name)
      return
    }
    onRename(next)
  }

  const cancel = () => {
    setDraft(name)
    setEditing(false)
  }

  if (!editable) {
    return (
      <span className={className} title={title ?? name}>
        {name}
      </span>
    )
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`tab-name-input ${className ?? ''}`}
        value={draft}
        aria-label="Tab name"
        onChange={(event) => setDraft(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            cancel()
          }
        }}
        onBlur={commit}
      />
    )
  }

  return (
    <span className={`tab-name-display ${className ?? ''}`}>
      <span
        className="tab-name-text"
        title={title ?? `${name} · Double-click to rename`}
        onDoubleClick={(event) => {
          event.stopPropagation()
          event.preventDefault()
          setEditing(true)
        }}
      >
        {name}
      </span>
      <button
        type="button"
        className="tab-rename-btn"
        title="Rename"
        aria-label={`Rename ${name}`}
        onClick={(event) => {
          event.stopPropagation()
          setEditing(true)
        }}
      >
        <Pencil size={11} />
      </button>
    </span>
  )
}
