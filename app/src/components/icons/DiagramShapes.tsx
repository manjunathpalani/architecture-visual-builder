import type { DiagramShape } from '../../types'
import { getSpecFromProperties } from '../../types/interfaceSpec'
import { methodColor } from '../../types/interfaceSpec'

interface ShapeProps {
  shape: DiagramShape
  label: string
  selected?: boolean
  properties?: Record<string, string | undefined>
}

export function DiagramShapeRenderer({ shape, label, selected, properties }: ShapeProps) {
  const spec = properties ? getSpecFromProperties(properties) : null
  const cls = `diagram-shape diagram-${shape} ${selected ? 'selected' : ''}`

  switch (shape) {
    case 'actor':
      return (
        <div className={cls}>
          <div className="shape-actor-icon">
            <svg viewBox="0 0 40 48" width="36" height="44">
              <circle cx="20" cy="10" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M20 17v10M10 48l10-18 10 18" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </div>
          <span>{label}</span>
        </div>
      )
    case 'class':
      return (
        <div className={cls}>
          <div className="shape-class-header">{label}</div>
          <div className="shape-class-divider" />
          <div className="shape-class-body">+ attributes<br />+ methods()</div>
        </div>
      )
    case 'interface':
      return (
        <div className={cls}>
          <div className="shape-interface-label">«interface»</div>
          <div className="shape-class-header">{label}</div>
          <div className="shape-class-divider" />
          <div className="shape-class-body">
            {spec && spec.endpoints.length > 0 ? (
              <>
                {spec.endpoints.slice(0, 5).map((ep, i) => (
                  <div key={i} className="shape-interface-op">
                    <span
                      className="spec-method tiny"
                      style={{ background: methodColor(ep.method) }}
                    >
                      {ep.method}
                    </span>
                    <span>{ep.path}</span>
                  </div>
                ))}
                {spec.endpoints.length > 5 && (
                  <div className="shape-interface-op">+{spec.endpoints.length - 5} more</div>
                )}
              </>
            ) : (
              <>+ operation()</>
            )}
          </div>
        </div>
      )
    case 'component':
      return (
        <div className={cls}>
          <div className="shape-component-tab" />
          <span className="shape-component-label">{label}</span>
        </div>
      )
    case 'process':
      return (
        <div className={cls}>
          <span>{label}</span>
        </div>
      )
    case 'decision':
      return (
        <div className={cls}>
          <div className="shape-diamond">
            <span>{label}</span>
          </div>
        </div>
      )
    case 'package':
      return (
        <div className={cls}>
          <div className="shape-package-tab" />
          <div className="shape-package-body">{label}</div>
        </div>
      )
    case 'datastore':
      return (
        <div className={cls}>
          <div className="shape-db-top" />
          <div className="shape-db-body">{label}</div>
          <div className="shape-db-bottom" />
        </div>
      )
    case 'queue':
      return (
        <div className={cls}>
          <div className="shape-queue-lines">
            <span /><span /><span />
          </div>
          <span>{label}</span>
        </div>
      )
    case 'c4-person':
      return (
        <div className={cls}>
          <div className="shape-c4-person-icon">👤</div>
          <div className="shape-c4-caption">Person</div>
          <span>{label}</span>
        </div>
      )
    case 'c4-system':
      return (
        <div className={cls}>
          <div className="shape-c4-badge">Software System</div>
          <span>{label}</span>
        </div>
      )
    case 'c4-container':
      return (
        <div className={cls}>
          <div className="shape-c4-badge">Container</div>
          <span>{label}</span>
        </div>
      )
    default:
      return <div className={cls}><span>{label}</span></div>
  }
}