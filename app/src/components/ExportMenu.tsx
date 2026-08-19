import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, FileDown, FileText, Presentation } from 'lucide-react'

interface ExportMenuProps {
  exporting: boolean
  onExportJson: () => void
  onExportPptx: () => void
  onExportDocx: () => void
}

export function ExportMenu({ exporting, onExportJson, onExportPptx, onExportDocx }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const run = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <div className={`export-menu ${open ? 'open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="btn-primary export-menu-trigger"
        disabled={exporting}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Download size={16} />
        {exporting ? 'Exporting…' : 'Export'}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="export-menu-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => run(onExportJson)}>
            <FileDown size={15} />
            <span>
              <strong>Architecture JSON</strong>
              <em>Machine-readable project file</em>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => run(onExportPptx)}>
            <Presentation size={15} />
            <span>
              <strong>PowerPoint briefing</strong>
              <em>Diagram plus spoken explanations</em>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => run(onExportDocx)}>
            <FileText size={15} />
            <span>
              <strong>Word SAD document</strong>
              <em>Solution Architecture Document</em>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
