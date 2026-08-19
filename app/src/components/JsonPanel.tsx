import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'

interface JsonPanelProps {
  json: string
  error: string | null
  onApply: (json: string) => void
  onClose: () => void
}

export function JsonPanel({ json, error, onApply, onClose }: JsonPanelProps) {
  const [editedJson, setEditedJson] = useState(json)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="json-panel-overlay">
      <div className="json-panel">
        <div className="json-panel-header">
          <div>
            <h2>JSON Editor</h2>
            <p>Edit the architecture document directly — changes sync to the canvas on Apply</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {error && <div className="json-error">{error}</div>}
        <textarea
          className="json-editor"
          value={editedJson}
          onChange={(e) => setEditedJson(e.target.value)}
          spellCheck={false}
        />
        <div className="json-panel-actions">
          <button type="button" className="btn-secondary" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="btn-primary" onClick={() => onApply(editedJson)}>
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  )
}