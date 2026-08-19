import type { InterfaceSpec } from '../types/interfaceSpec'
import { methodColor, uniqueMethods } from '../types/interfaceSpec'

interface InterfaceSpecViewerProps {
  spec: InterfaceSpec
  compact?: boolean
  maxEndpoints?: number
  onViewFull?: () => void
}

export function InterfaceSpecViewer({
  spec,
  compact,
  maxEndpoints = compact ? 2 : 10,
  onViewFull,
}: InterfaceSpecViewerProps) {
  const endpoints = spec.endpoints.slice(0, maxEndpoints)
  const remaining = spec.endpoints.length - endpoints.length
  const methods = uniqueMethods(spec.endpoints)

  return (
    <div className={`interface-spec-viewer ${compact ? 'compact' : ''}`}>
      {!compact && (
        <div className="spec-header">
          <span className="spec-title">{spec.title}</span>
          <span className="spec-version">v{spec.version}</span>
        </div>
      )}
      {spec.baseUrl && !compact && (
        <div className="spec-base-url">{spec.baseUrl}</div>
      )}
      {methods.length > 0 && (
        <div className="swagger-method-badges">
          {methods.map((method) => (
            <span key={method} className="spec-method" style={{ background: methodColor(method) }}>
              {method}
            </span>
          ))}
          <span className="spec-op-count">
            {spec.endpoints.length} op{spec.endpoints.length === 1 ? '' : 's'}
          </span>
        </div>
      )}
      <div className="spec-endpoints">
        {endpoints.map((ep, i) => (
          <div key={`${ep.method}-${ep.path}-${i}`} className="spec-endpoint">
            <span
              className="spec-method"
              style={{ background: methodColor(ep.method) }}
            >
              {ep.method}
            </span>
            <span className="spec-path">{ep.path}</span>
            {ep.summary && !compact && (
              <span className="spec-summary">{ep.summary}</span>
            )}
          </div>
        ))}
        {remaining > 0 && (
          <button type="button" className="spec-more" onClick={onViewFull}>
            +{remaining} more endpoint{remaining > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  )
}