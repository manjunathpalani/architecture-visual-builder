import { Bold, Code, Heading2, Italic, Link, List, ListOrdered, Quote } from 'lucide-react'
import { useRef, useState } from 'react'
import { hasRichNotes, renderRichNotes, wrapSelection } from '../utils/richNotes'

interface RichNotesEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  rows?: number
}

export function RichNotesEditor({
  value,
  onChange,
  placeholder = 'Add notes with headings, lists, bold, and links…',
  label = 'Notes',
  rows = 8,
}: RichNotesEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)

  const apply = (before: string, after = before, placeholderText = 'text') => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const result = wrapSelection(value, start, end, before, after, placeholderText)
    onChange(result.next)
    window.requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(result.selectStart, result.selectEnd)
    })
  }

  const applyLinePrefix = (prefix: string) => {
    const el = ref.current
    const start = el?.selectionStart ?? 0
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`
    onChange(next)
    window.requestAnimationFrame(() => {
      const cursor = start + prefix.length
      el?.focus()
      el?.setSelectionRange(cursor, cursor)
    })
  }

  const applyLink = () => {
    const url = window.prompt('Link URL', 'https://')
    if (!url?.trim()) return
    apply('[', `](${url.trim()})`, 'label')
  }

  return (
    <div className="rich-notes-editor">
      <div className="rich-notes-header">
        <span className="color-picker-label">{label}</span>
        <div className="rich-notes-modes">
          <button type="button" className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>
            Edit
          </button>
          <button
            type="button"
            className={preview ? 'active' : ''}
            onClick={() => setPreview(true)}
            disabled={!hasRichNotes(value)}
          >
            Preview
          </button>
        </div>
      </div>
      {!preview && (
        <div className="rich-notes-toolbar" role="toolbar" aria-label="Note formatting">
          <button type="button" title="Bold" onClick={() => apply('**')}>
            <Bold size={13} />
          </button>
          <button type="button" title="Italic" onClick={() => apply('*')}>
            <Italic size={13} />
          </button>
          <button type="button" title="Heading" onClick={() => applyLinePrefix('## ')}>
            <Heading2 size={13} />
          </button>
          <button type="button" title="Bulleted list" onClick={() => applyLinePrefix('- ')}>
            <List size={13} />
          </button>
          <button type="button" title="Numbered list" onClick={() => applyLinePrefix('1. ')}>
            <ListOrdered size={13} />
          </button>
          <button type="button" title="Quote" onClick={() => applyLinePrefix('> ')}>
            <Quote size={13} />
          </button>
          <button type="button" title="Code" onClick={() => apply('`')}>
            <Code size={13} />
          </button>
          <button type="button" title="Link" onClick={applyLink}>
            <Link size={13} />
          </button>
        </div>
      )}
      {preview ? (
        <div
          className="rich-notes-preview"
          dangerouslySetInnerHTML={{ __html: renderRichNotes(value) }}
        />
      ) : (
        <textarea
          ref={ref}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <span className="code-link-hint">
        Rich notes support **bold**, *italic*, lists, headings, `code`, and [links](https://…).
      </span>
    </div>
  )
}
