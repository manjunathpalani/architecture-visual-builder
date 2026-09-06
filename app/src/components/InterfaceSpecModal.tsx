import { X } from 'lucide-react'
import type { InterfaceSpec } from '../types/interfaceSpec'
import { methodColor } from '../types/interfaceSpec'

interface InterfaceSpecModalProps {
  spec: InterfaceSpec
  onClose: () => void
}

export function InterfaceSpecModal({ spec, onClose }: InterfaceSpecModalProps) {
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
            <h2>{spec.title}</h2>
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
          <h3>Endpoints ({spec.endpoints.length})</h3>
          {spec.endpoints.length === 0 ? (
            <p className="code-link-hint">No endpoints defined.</p>
          ) : (
            <div className="interface-spec-modal-list">
              {spec.endpoints.map((ep, i) => (
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
              ))}
            </div>
          )}

          {spec.rawOpenApi && (
            <details className="spec-raw-openapi">
              <summary>Raw OpenAPI JSON</summary>
              <pre>{spec.rawOpenApi}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}