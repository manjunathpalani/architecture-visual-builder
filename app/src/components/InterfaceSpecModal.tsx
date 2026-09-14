import { useState } from 'react'
import { Braces, Plus, Trash2, X } from 'lucide-react'
import {
  HTTP_METHODS,
  parseOpenApiDocument,
  parsedOpenApiToInterfaceSpec,
  serializeInterfaceSpec,
  type ApiEndpoint,
  type HttpMethod,
  type InterfaceSpec,
} from '../types/interfaceSpec'
import { InterfaceSpecViewer } from './InterfaceSpecViewer'
import { methodColor } from '../types/interfaceSpec'

interface InterfaceSpecModalProps {
  spec: InterfaceSpec
  defaultTitle?: string
  onClose: () => void
  onSave?: (json: string) => void
  onRemove?: () => void
  onInjectSwagger?: () => void
}

export function InterfaceSpecModal({
  spec,
  defaultTitle = 'API Interface',
  onClose,
  onSave,
  onRemove,
  onInjectSwagger,
}: InterfaceSpecModalProps) {
  const [mode, setMode] = useState<'simple' | 'openapi'>('simple')
  const editable = Boolean(onSave)

  const save = (updated: InterfaceSpec) => {
    if (!onSave) return
    onSave(serializeInterfaceSpec(updated))
  }

  const updateEndpoint = (index: number, patch: Partial<ApiEndpoint>) => {
    if (!editable) return
    const endpoints = spec.endpoints.map((ep, i) =>
      i === index ? { ...ep, ...patch } : ep,
    )
    save({ ...spec, endpoints })
  }

  const addEndpoint = () => {
    if (!editable) return
    save({
      ...spec,
      endpoints: [
        ...spec.endpoints,
        { method: 'GET', path: '/new-endpoint', summary: 'New endpoint' },
      ],
    })
  }

  const removeEndpoint = (index: number) => {
    if (!editable) return
    save({ ...spec, endpoints: spec.endpoints.filter((_, i) => i !== index) })
  }

  const handleOpenApiPaste = (raw: string) => {
    if (!editable) return
    try {
      const parsed = parseOpenApiDocument(raw)
      save(parsedOpenApiToInterfaceSpec(parsed))
    } catch {
      save({
        ...spec,
        specFormat: 'openapi',
        rawOpenApi: raw,
        endpoints: [],
      })
    }
  }

  return (
    <div
      className="interface-spec-overlay"
      onClick={(event) => {
        event.stopPropagation()
        onClose()
      }}
    >
      <div className="interface-spec-modal" onClick={(e) => e.stopPropagation()}>
        <div className="interface-spec-modal-header">
          <div>
            <h2>{spec.title || defaultTitle}</h2>
            <p>
              v{spec.version}
              {spec.baseUrl && <> · <code>{spec.baseUrl}</code></>}
            </p>
          </div>
          <div className="dialog-header-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Back
            </button>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {spec.description && (
          <p className="interface-spec-modal-desc">{spec.description}</p>
        )}

        <div className="interface-spec-modal-body">
          {editable && (
            <div className="spec-mode-tabs">
              <button
                type="button"
                className={`spec-mode-tab ${mode === 'simple' ? 'active' : ''}`}
                onClick={() => setMode('simple')}
              >
                Endpoint Editor
              </button>
              <button
                type="button"
                className={`spec-mode-tab ${mode === 'openapi' ? 'active' : ''}`}
                onClick={() => setMode('openapi')}
              >
                OpenAPI JSON
              </button>
            </div>
          )}

          {editable && mode === 'simple' ? (
            <>
              <label>
                API Title
                <input
                  value={spec.title}
                  onChange={(e) => save({ ...spec, title: e.target.value })}
                />
              </label>
              <label>
                Version
                <input
                  value={spec.version}
                  onChange={(e) => save({ ...spec, version: e.target.value })}
                />
              </label>
              <label>
                Base URL
                <input
                  placeholder="https://api.example.com/v1"
                  value={spec.baseUrl ?? ''}
                  onChange={(e) => save({ ...spec, baseUrl: e.target.value })}
                />
              </label>
              <label>
                Description
                <textarea
                  rows={2}
                  value={spec.description ?? ''}
                  onChange={(e) => save({ ...spec, description: e.target.value })}
                />
              </label>

              <div className="spec-endpoints-editor">
                <span className="color-picker-label">Endpoints</span>
                {spec.endpoints.map((ep, i) => (
                  <div key={i} className="spec-endpoint-row">
                    <select
                      value={ep.method}
                      onChange={(e) =>
                        updateEndpoint(i, { method: e.target.value as HttpMethod })
                      }
                    >
                      {HTTP_METHODS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <input
                      placeholder="/path"
                      value={ep.path}
                      onChange={(e) => updateEndpoint(i, { path: e.target.value })}
                    />
                    <input
                      placeholder="Summary"
                      value={ep.summary ?? ''}
                      onChange={(e) => updateEndpoint(i, { summary: e.target.value })}
                    />
                    <button
                      type="button"
                      className="icon-btn spec-delete-btn"
                      onClick={() => removeEndpoint(i)}
                      aria-label="Remove endpoint"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={addEndpoint}>
                  <Plus size={14} /> Add Endpoint
                </button>
              </div>
            </>
          ) : editable && mode === 'openapi' ? (
            <label>
              Paste OpenAPI 3.x JSON
              <textarea
                className="openapi-paste"
                rows={8}
                placeholder='{"openapi":"3.0.0","paths":{...}}'
                value={spec.rawOpenApi ?? ''}
                onChange={(e) => handleOpenApiPaste(e.target.value)}
                spellCheck={false}
              />
            </label>
          ) : null}

          <div className="spec-preview-box">
            <span className="color-picker-label">Preview</span>
            <InterfaceSpecViewer spec={spec} maxEndpoints={5} />
          </div>

          {editable && (
            <div className="code-link-actions">
              {onInjectSwagger && (
                <button type="button" className="btn-secondary" onClick={onInjectSwagger}>
                  <Braces size={14} />
                  Inject Swagger
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={onClose}>
                Done
              </button>
              {onRemove && (
                <button type="button" className="btn-reset-color" onClick={onRemove}>
                  Remove Spec
                </button>
              )}
            </div>
          )}

          {spec.rawOpenApi && (
            <details className="spec-raw-openapi">
              <summary>Raw OpenAPI JSON</summary>
              <pre>{spec.rawOpenApi}</pre>
            </details>
          )}

          <div className="interface-spec-modal-list">
            <h3>Endpoints ({spec.endpoints.length})</h3>
            {spec.endpoints.length === 0 ? (
              <p className="code-link-hint">No endpoints defined.</p>
            ) : (
              spec.endpoints.map((ep, i) => (
                <div key={i} className="interface-spec-modal-endpoint">
                  <div className="interface-spec-modal-endpoint-header">
                    <span
                      className="spec-method"
                      style={{ background: methodColor(ep.method) }}
                    >
                      {ep.method}
                    </span>
                    <code className="spec-path-full">{ep.path}</code>
                  </div>
                  {ep.summary && <div className="spec-endpoint-summary">{ep.summary}</div>}
                  {ep.description && (
                    <div className="spec-endpoint-desc">{ep.description}</div>
                  )}
                  {ep.requestSchema && (
                    <div className="spec-schema-block">
                      <span className="spec-schema-label">Request</span>
                      <pre>{ep.requestSchema}</pre>
                    </div>
                  )}
                  {ep.responseSchema && (
                    <div className="spec-schema-block">
                      <span className="spec-schema-label">Response</span>
                      <pre>{ep.responseSchema}</pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}