import { Download, LayoutTemplate, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  downloadUserTemplate,
  downloadUserTemplatesExport,
  importTemplatesFromJson,
  loadUserTemplates,
  removeUserTemplate,
  updateUserTemplate,
  type UserTemplate,
} from '../utils/userTemplates'

export function TemplatesSettingsPanel() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [templates, setTemplates] = useState<UserTemplate[]>(() => loadUserTemplates())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => setTemplates(loadUserTemplates())

  const importFiles = async (files: FileList | File[]) => {
    setError(null)
    setMessage(null)
    let added = 0
    try {
      for (const file of Array.from(files)) {
        const text = await file.text()
        added += importTemplatesFromJson(text, file.name).length
      }
      refresh()
      setMessage(added === 1 ? 'Imported 1 template.' : `Imported ${added} templates.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import that file as a template')
    }
  }

  return (
    <div className="templates-settings">
      <div className="templates-settings-intro">
        <h3>
          <LayoutTemplate size={16} />
          Saved templates
        </h3>
        <p>
          Save the current diagram from File → Save as template, or import architecture JSON here. Saved
          templates appear in New tab under Saved.
        </p>
      </div>

      <div className="templates-settings-actions">
        <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
          <Upload size={14} />
          Import JSON…
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => downloadUserTemplatesExport(templates)}
          disabled={templates.length === 0}
        >
          <Download size={14} />
          Export all
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          multiple
          hidden
          onChange={(event) => {
            const files = event.target.files
            event.target.value = ''
            if (files?.length) void importFiles(files)
          }}
        />
      </div>

      {message && <p className="templates-settings-ok">{message}</p>}
      {error && <p className="templates-settings-error">{error}</p>}

      {templates.length === 0 ? (
        <p className="code-link-hint">No saved templates yet.</p>
      ) : (
        <ul className="templates-settings-list">
          {templates.map((template) => (
            <li key={template.id} className="templates-settings-item">
              <div>
                <input
                  className="templates-settings-name"
                  value={template.name}
                  aria-label="Template name"
                  onChange={(event) => {
                    const name = event.target.value
                    setTemplates((current) =>
                      current.map((item) => (item.id === template.id ? { ...item, name } : item)),
                    )
                  }}
                  onBlur={(event) => {
                    updateUserTemplate(template.id, { name: event.target.value })
                    refresh()
                  }}
                />
                <p>
                  {template.document.systems.length} components · {template.document.integrations.length}{' '}
                  integrations
                </p>
              </div>
              <span className="templates-settings-tools">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => downloadUserTemplate(template)}
                >
                  Export
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Delete template"
                  aria-label={`Delete ${template.name}`}
                  onClick={() => {
                    removeUserTemplate(template.id)
                    refresh()
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
