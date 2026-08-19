import { useMemo, useRef, useState } from 'react'
import { Braces, FileUp, Link2, Loader2, X } from 'lucide-react'
import type { SystemNode } from '../types'
import {
  methodColor,
  uniqueMethods,
  type InterfaceSpec,
  type ParsedOpenApi,
} from '../types/interfaceSpec'
import {
  componentToInterfaceSpec,
  computeInjectOrigin,
  fetchSwaggerSpec,
  groupSwaggerComponents,
  mergeComponentsToInterfaceSpec,
  parseSwaggerSource,
  swaggerComponentsToSystems,
  type SwaggerApiComponent,
  type SwaggerGroupMode,
} from '../utils/swaggerInjector'

const PETSTORE_DEMO = 'https://petstore3.swagger.io/api/v3/openapi.json'

interface SwaggerInjectorModalProps {
  mode: 'canvas' | 'spec'
  existingSystems?: SystemNode[]
  onInjectSystems?: (systems: SystemNode[]) => void
  onApplySpec?: (spec: InterfaceSpec) => void
  onClose: () => void
}

export function SwaggerInjectorModal({
  mode,
  existingSystems = [],
  onInjectSystems,
  onApplySpec,
  onClose,
}: SwaggerInjectorModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sourceTab, setSourceTab] = useState<'url' | 'paste' | 'file'>('url')
  const [url, setUrl] = useState('')
  const [paste, setPaste] = useState('')
  const [groupMode, setGroupMode] = useState<SwaggerGroupMode>('tag')
  const [nodeStyle, setNodeStyle] = useState<'api' | 'interface'>('api')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedOpenApi | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const components = useMemo(
    () => (parsed ? groupSwaggerComponents(parsed, groupMode) : []),
    [parsed, groupMode],
  )

  const selectedComponents = components.filter((c) => selectedIds.has(c.id))

  const applyParsed = (next: ParsedOpenApi) => {
    const grouped = groupSwaggerComponents(next, groupMode)
    setParsed(next)
    setSelectedIds(new Set(grouped.map((c) => c.id)))
    setError(null)
  }

  const handleRaw = (raw: string) => {
    try {
      applyParsed(parseSwaggerSource(raw))
    } catch (err) {
      setParsed(null)
      setSelectedIds(new Set())
      setError(err instanceof Error ? err.message : 'Could not parse spec')
    }
  }

  const handleFetch = async (sourceUrl = url) => {
    setLoading(true)
    setError(null)
    try {
      const raw = await fetchSwaggerSpec(sourceUrl)
      setUrl(sourceUrl)
      handleRaw(raw)
    } catch (err) {
      setParsed(null)
      setSelectedIds(new Set())
      setError(err instanceof Error ? err.message : 'Fetch failed')
    } finally {
      setLoading(false)
    }
  }

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => handleRaw(String(reader.result ?? ''))
    reader.readAsText(file)
    event.target.value = ''
  }

  const toggleComponent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(components.map((c) => c.id)))
  const selectNone = () => setSelectedIds(new Set())

  const handleInject = () => {
    if (!parsed || selectedComponents.length === 0) return

    if (mode === 'spec') {
      onApplySpec?.(mergeComponentsToInterfaceSpec(parsed, selectedComponents))
      onClose()
      return
    }

    const origin = computeInjectOrigin(existingSystems)
    const systems = swaggerComponentsToSystems(parsed, selectedComponents, origin, nodeStyle)
    onInjectSystems?.(systems)
    onClose()
  }

  return (
    <div className="swagger-overlay" onClick={onClose}>
      <div className="swagger-modal" onClick={(e) => e.stopPropagation()}>
        <div className="swagger-modal-header">
          <div>
            <h2>
              <Braces size={20} />
              Swagger Injector
            </h2>
            <p>
              {mode === 'canvas'
                ? 'Import a Swagger / OpenAPI spec and drop API components with their methods onto the canvas.'
                : 'Import a Swagger / OpenAPI spec and apply its methods to this API component.'}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="swagger-modal-body">
          <div className="spec-mode-tabs">
            <button
              type="button"
              className={`spec-mode-tab ${sourceTab === 'url' ? 'active' : ''}`}
              onClick={() => setSourceTab('url')}
            >
              URL
            </button>
            <button
              type="button"
              className={`spec-mode-tab ${sourceTab === 'paste' ? 'active' : ''}`}
              onClick={() => setSourceTab('paste')}
            >
              Paste JSON
            </button>
            <button
              type="button"
              className={`spec-mode-tab ${sourceTab === 'file' ? 'active' : ''}`}
              onClick={() => setSourceTab('file')}
            >
              Upload file
            </button>
          </div>

          {sourceTab === 'url' && (
            <div className="swagger-url-row">
              <label>
                OpenAPI / Swagger JSON URL
                <input
                  placeholder="https://api.example.com/v3/api-docs"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleFetch()}
                />
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={loading || !url.trim()}
                onClick={() => void handleFetch()}
              >
                {loading ? <Loader2 size={14} className="spin" /> : <Link2 size={14} />}
                Fetch
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={loading}
                onClick={() => void handleFetch(PETSTORE_DEMO)}
              >
                Petstore demo
              </button>
            </div>
          )}

          {sourceTab === 'paste' && (
            <label>
              OpenAPI 3.x or Swagger 2.0 JSON
              <textarea
                className="openapi-paste"
                rows={8}
                placeholder='{"openapi":"3.0.0","info":{"title":"Orders API"},"paths":{...}}'
                value={paste}
                onChange={(e) => {
                  setPaste(e.target.value)
                  if (e.target.value.trim()) handleRaw(e.target.value)
                }}
                spellCheck={false}
              />
            </label>
          )}

          {sourceTab === 'file' && (
            <div className="swagger-file-row">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={handleFile}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp size={14} />
                Choose swagger.json
              </button>
              <p className="code-link-hint">
                JSON only. For YAML, use the spec’s JSON URL or convert first.
                A sample file is available at <code>sample-swagger.json</code>.
              </p>
            </div>
          )}

          {error && <div className="swagger-error">{error}</div>}

          {parsed && (
            <>
              <div className="swagger-summary">
                <strong>{parsed.title}</strong>
                <span>v{parsed.version}</span>
                {parsed.baseUrl && <code>{parsed.baseUrl}</code>}
                <span>
                  {parsed.endpoints.length} operation{parsed.endpoints.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="swagger-options">
                <label className="swagger-option">
                  Group by
                  <select
                    value={groupMode}
                    onChange={(e) => {
                      const next = e.target.value as SwaggerGroupMode
                      setGroupMode(next)
                      if (parsed) {
                        const grouped = groupSwaggerComponents(parsed, next)
                        setSelectedIds(new Set(grouped.map((c) => c.id)))
                      }
                    }}
                  >
                    <option value="tag">API tag (one component per tag)</option>
                    <option value="single">Single API component</option>
                  </select>
                </label>
                {mode === 'canvas' && (
                  <label className="swagger-option">
                    Show as
                    <select
                      value={nodeStyle}
                      onChange={(e) => setNodeStyle(e.target.value as 'api' | 'interface')}
                    >
                      <option value="api">API component (methods listed)</option>
                      <option value="interface">UML interface shape</option>
                    </select>
                  </label>
                )}
              </div>

              <div className="swagger-preview-header">
                <span className="color-picker-label">
                  API components ({selectedComponents.length}/{components.length} selected)
                </span>
                <div className="swagger-select-actions">
                  <button type="button" className="btn-reset-color" onClick={selectAll}>
                    Select all
                  </button>
                  <button type="button" className="btn-reset-color" onClick={selectNone}>
                    None
                  </button>
                </div>
              </div>

              <div className="swagger-component-list">
                {components.map((component) => (
                  <SwaggerComponentCard
                    key={component.id}
                    component={component}
                    selected={selectedIds.has(component.id)}
                    onToggle={() => toggleComponent(component.id)}
                    spec={parsed ? componentToInterfaceSpec(parsed, component) : undefined}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="swagger-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!parsed || selectedComponents.length === 0}
            onClick={handleInject}
          >
            <Braces size={14} />
            {mode === 'canvas'
              ? `Inject ${selectedComponents.length || ''} component${selectedComponents.length === 1 ? '' : 's'}`
              : 'Apply methods to component'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SwaggerComponentCard({
  component,
  selected,
  onToggle,
  spec,
}: {
  component: SwaggerApiComponent
  selected: boolean
  onToggle: () => void
  spec?: InterfaceSpec
}) {
  const methods = uniqueMethods(component.endpoints)
  const preview = component.endpoints.slice(0, 6)
  const remaining = component.endpoints.length - preview.length

  return (
    <label className={`swagger-component-card ${selected ? 'selected' : ''}`}>
      <input type="checkbox" checked={selected} onChange={onToggle} />
      <div className="swagger-component-body">
        <div className="swagger-component-title">
          <strong>{component.name}</strong>
          <span>
            {component.endpoints.length} method{component.endpoints.length === 1 ? '' : 's'}
          </span>
        </div>
        {component.description && (
          <p className="swagger-component-desc">{component.description}</p>
        )}
        <div className="swagger-method-badges">
          {methods.map((method) => (
            <span key={method} className="spec-method" style={{ background: methodColor(method) }}>
              {method}
            </span>
          ))}
        </div>
        <div className="spec-endpoints">
          {preview.map((ep, i) => (
            <div key={`${ep.method}-${ep.path}-${i}`} className="spec-endpoint">
              <span className="spec-method tiny" style={{ background: methodColor(ep.method) }}>
                {ep.method}
              </span>
              <span className="spec-path">{ep.path}</span>
              {ep.summary && <span className="spec-summary">{ep.summary}</span>}
            </div>
          ))}
          {remaining > 0 && (
            <div className="spec-summary">+{remaining} more</div>
          )}
        </div>
        {spec?.baseUrl && <div className="spec-base-url">{spec.baseUrl}</div>}
      </div>
    </label>
  )
}
