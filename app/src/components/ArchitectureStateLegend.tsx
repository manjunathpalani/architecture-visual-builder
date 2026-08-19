import {
  CHANGE_STATUS_COLORS,
  CHANGE_STATUS_HINTS,
  CHANGE_STATUS_LABELS,
  CHANGE_STATUSES,
  STATE_VIEWS,
  type ArchitectureStateView,
} from '../utils/architectureState'

interface ArchitectureStateLegendProps {
  view: ArchitectureStateView
  onChangeView: (view: ArchitectureStateView) => void
}

export function ArchitectureStateLegend({ view, onChangeView }: ArchitectureStateLegendProps) {
  return (
    <div className="architecture-state-dock">
      <div className="architecture-state-toolbar">
        <span className="flow-legend-title">Architecture state</span>
        {STATE_VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`flow-color-btn ${view === item.id ? 'active' : ''}`}
            title={item.hint}
            onClick={() => onChangeView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="architecture-state-legend">
        <span className="flow-legend-title">Legend</span>
        {CHANGE_STATUSES.map((status) => (
          <span
            key={status}
            className="state-legend-item"
            title={CHANGE_STATUS_HINTS[status]}
          >
            <i
              className={`state-swatch change-${status}`}
              style={{ background: CHANGE_STATUS_COLORS[status] }}
            />
            {CHANGE_STATUS_LABELS[status]}
          </span>
        ))}
      </div>
    </div>
  )
}
