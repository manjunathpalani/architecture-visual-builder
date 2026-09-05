import { History, X } from 'lucide-react'
import type { ArchitectureDocument, AuditKind } from '../types'
import { formatAuditTime, sanitizeAudit } from '../utils/auditLog'

interface AuditTrailPanelProps {
  document: ArchitectureDocument
  onClose: () => void
  onClear: () => void
}

const KIND_LABEL: Record<AuditKind, string> = {
  add: 'Add',
  remove: 'Remove',
  update: 'Update',
  move: 'Move',
  connect: 'Connect',
  draw: 'Draw',
  import: 'Import',
  ai: 'AI',
  navigate: 'Navigate',
}

export function AuditTrailPanel({ document, onClose, onClear }: AuditTrailPanelProps) {
  const events = sanitizeAudit(document.audit)

  return (
    <div className="code-links-overlay">
      <div className="code-links-panel audit-panel">
        <div className="code-links-panel-header">
          <div>
            <h2>
              <History size={20} />
              Audit trail
            </h2>
            <p>
              {events.length === 0
                ? 'No changes recorded yet for this project'
                : `${events.length} change${events.length === 1 ? '' : 's'} on ${document.metadata.name}`}
            </p>
          </div>
          <div className="audit-header-actions">
            {events.length > 0 && (
              <button type="button" className="btn-reset-color" onClick={onClear}>
                Clear trail
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="code-links-empty">
            <p>Move, connect, edit, or add components to start the audit log.</p>
            <p>Each action is stored with the project JSON and local autosave.</p>
          </div>
        ) : (
          <ol className="audit-list">
            {events.map((event) => (
              <li key={event.id} className={`audit-item kind-${event.kind}`}>
                <div className="audit-item-meta">
                  <span className={`audit-kind kind-${event.kind}`}>
                    {KIND_LABEL[event.kind] ?? event.kind}
                  </span>
                  <span className="audit-time">{formatAuditTime(event.at)}</span>
                  <span className="audit-actor">{event.actor}</span>
                </div>
                <strong>{event.summary}</strong>
                {event.details.length > 0 && event.details[0] !== event.summary && (
                  <ul className="audit-details">
                    {event.details.map((line, index) => (
                      <li key={`${event.id}-${index}`}>{line}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
