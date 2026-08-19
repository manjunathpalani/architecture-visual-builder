import { useState } from 'react'
import { Braces, FileCode, Plus, Trash2, Eye } from 'lucide-react'
import {
  createDefaultInterfaceSpec,
  HTTP_METHODS,
  parseInterfaceSpec,
  parseOpenApiDocument,
  parsedOpenApiToInterfaceSpec,
  serializeInterfaceSpec,
  type ApiEndpoint,
  type HttpMethod,
  type InterfaceSpec,
} from '../types/interfaceSpec'
import { InterfaceSpecViewer } from './InterfaceSpecViewer'
import { InterfaceSpecModal } from './InterfaceSpecModal'
import { SwaggerInjectorModal } from './SwaggerInjectorModal'

interface InterfaceSpecSectionProps {
  interfaceSpecJson?: string
  defaultTitle?: string
  onChange: (json: string) => void
}

export function InterfaceSpecSection({
  interfaceSpecJson,
  defaultTitle = 'API Interface',
  onChange,
}: InterfaceSpecSectionProps) {
  const [showModal, setShowModal] = useState(false)
  const [showInjector, setShowInjector] = useState(false)
  const [mode, setMode] = useState<'simple' | 'openapi'>('simple')

  const spec =
    parseInterfaceSpec(interfaceSpecJson) ?? createDefaultInterfaceSpec(defaultTitle)

  const save = (updated: InterfaceSpec) => {
    onChange(serializeInterfaceSpec(updated))
  }

  const updateEndpoint = (index: number, patch: Partial<ApiEndpoint>) => {
    const endpoints = spec.endpoints.map((ep, i) =>
      i === index ? { ...ep, ...patch } : ep,
    )
    save({ ...spec, endpoints })
  }

  const addEndpoint = () => {
    save({
      ...spec,
      endpoints: [
        ...spec.endpoints,
        { method: 'GET', path: '/new-endpoint', summary: 'New endpoint' },
      ],
    })
  }

  const removeEndpoint = (index: number) => {
    save({ ...spec, endpoints: spec.endpoints.filter((_, i) => i !== index) })
  }

  const handleOpenApiPaste = (raw: string) => {
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

  const initSpec = () => {
    onChange(serializeInterfaceSpec(createDefaultInterfaceSpec(defaultTitle)))
  }

  const hasSpec = Boolean(interfaceSpecJson?.trim())

  return (
    <div className="interface-spec-section">
      <div className="code-link-header">
        <FileCode size={16} />
        <span>Interface Specification</span>
      </div>
      <p className="code-link-hint">
        Define API endpoints, methods, and schemas for this component or integration.
      </p>

      {!hasSpec ? (
        <div className="spec-init-actions">
          <button type="button" className="btn-secondary" onClick={initSpec}>
            <Plus size={14} />
            Add Interface Spec
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowInjector(true)}>
            <Braces size={14} />
            Inject Swagger
          </button>
        </div>
      ) : (
        <>
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

          {mode === 'simple' ? (
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
          ) : (
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
          )}

          <div className="spec-preview-box">
            <span className="color-picker-label">Preview</span>
            <InterfaceSpecViewer spec={spec} maxEndpoints={5} />
          </div>

          <div className="code-link-actions">
            <button type="button" className="btn-secondary" onClick={() => setShowInjector(true)}>
              <Braces size={14} />
              Inject Swagger
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowModal(true)}>
              <Eye size={14} />
              View Full Spec
            </button>
            <button
              type="button"
              className="btn-reset-color"
              onClick={() => onChange('')}
            >
              Remove Spec
            </button>
          </div>
        </>
      )}

      {showModal && (
        <InterfaceSpecModal
          spec={spec}
          onClose={() => setShowModal(false)}
        />
      )}

      {showInjector && (
        <SwaggerInjectorModal
          mode="spec"
          onApplySpec={(next) => {
            save(next)
            setMode('simple')
          }}
          onClose={() => setShowInjector(false)}
        />
      )}
    </div>
  )
}