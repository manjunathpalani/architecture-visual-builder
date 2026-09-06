import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CornerUpLeft, Folder, FolderOpen } from 'lucide-react'

interface DiagramPageTitleProps {
  name: string
  isRoot: boolean
  statsLabel: string
  autosave: ReactNode
  onRename: (name: string) => void
  onGoRoot?: () => void
}

export function DiagramPageTitle({
  name,
  isRoot,
  statsLabel,
  autosave,
  onRename,
  onGoRoot,
}: DiagramPageTitleProps) {
  const [draft, setDraft] = useState(name)
  const skipBlurCommit = useRef(false)

  useEffect(() => {
    setDraft(name)
  }, [name])

  const commit = () => {
    const next = draft.trim()
    if (!next) {
      setDraft(name)
      return
    }
    if (next !== name) onRename(next)
  }

  return (
    <div className="doc-title diagram-page-title">
      {isRoot ? (
        <Folder size={18} />
      ) : (
        <button
          type="button"
          className="diagram-page-back"
          onClick={onGoRoot}
          title="Back to root diagram"
          aria-label="Back to root diagram"
        >
          <FolderOpen size={18} />
        </button>
      )}
      <div className="diagram-page-title-fields">
        <span className="diagram-page-kicker">
          {isRoot ? 'Diagram folder' : 'Sub-diagram folder'}
          {!isRoot && onGoRoot && (
            <button type="button" className="diagram-page-root-link" onClick={onGoRoot}>
              <CornerUpLeft size={12} />
              Root diagram
            </button>
          )}
        </span>
        <input
          className="doc-name-input"
          value={draft}
          aria-label="Diagram page name"
          title="Rename this diagram page"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (skipBlurCommit.current) {
              skipBlurCommit.current = false
              return
            }
            commit()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              skipBlurCommit.current = true
              commit()
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              skipBlurCommit.current = true
              setDraft(name)
              event.currentTarget.blur()
            }
          }}
        />
      </div>
      <span className="doc-stats">{statsLabel}</span>
      {autosave}
    </div>
  )
}
