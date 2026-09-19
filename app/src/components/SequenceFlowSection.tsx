import { ArrowDown, ArrowUp, Layers, Plus, Trash2, ZoomIn } from 'lucide-react'
import { useState } from 'react'
import type { ArchitectureDocument, Integration, SequenceFlowStep } from '../types'
import type { DiagramPath } from '../types/diagram'
import { generateId } from '../utils/jsonIO'
import { hasSubDiagramContent } from '../utils/diagramNavigation'
import {
  catalogSequence,
  listSequenceCatalogs,
  locateSequenceStep,
  type SequenceCatalogId,
} from '../utils/sequenceFlow'

interface SequenceFlowSectionProps {
  document: ArchitectureDocument
  drillPath: DiagramPath
  integration: Integration
  onChange: (steps: SequenceFlowStep[]) => void
  onOpenSequenceDiagram: () => void
  onOpenHop: (step: SequenceFlowStep) => void
}

export function SequenceFlowSection({
  document,
  drillPath,
  integration,
  onChange,
  onOpenSequenceDiagram,
  onOpenHop,
}: SequenceFlowSectionProps) {
  const catalogs = listSequenceCatalogs(document, drillPath, integration)
  const [catalogId, setCatalogId] = useState<SequenceCatalogId>(catalogs[0]?.id ?? 'current')
  const catalog = catalogs.find((item) => item.id === catalogId) ?? catalogs[0]
  const steps = integration.sequenceFlow ?? []
  const used = new Set(steps.map((step) => step.systemId))
  const available = catalog?.systems.filter((system) => !used.has(system.id)) ?? []

  const addStep = (systemId: string) => {
    const system = catalog?.systems.find((item) => item.id === systemId)
    if (!system) return
    onChange([...steps, { id: generateId('seq'), systemId: system.id, label: system.label }])
  }

  const move = (index: number, delta: number) => {
    const next = [...steps]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(next)
  }

  const fillFromCatalog = () => {
    if (!catalog) return
    onChange(catalogSequence(catalog))
  }

  return (
    <div className="sequence-flow-section">
      <p className="code-link-hint">
        Define the hop-by-hop sequence this integration travels through. You can pull components from this
        diagram or from another inner diagram.
      </p>
      <label>
        Component source
        <select
          value={catalog?.id ?? 'current'}
          onChange={(event) => setCatalogId(event.target.value as SequenceCatalogId)}
        >
          {catalogs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.systems.length})
            </option>
          ))}
        </select>
      </label>
      <div className="sequence-flow-actions">
        <button type="button" className="btn-secondary" onClick={fillFromCatalog} disabled={!catalog}>
          Fill sequence from this diagram
        </button>
        <button type="button" className="btn-secondary" onClick={onOpenSequenceDiagram}>
          <ZoomIn size={14} />
          {hasSubDiagramContent(integration.subDiagram) ? 'Open sequence diagram' : 'Create sequence diagram'}
        </button>
      </div>
      {available.length > 0 && (
        <label>
          Add component
          <span className="sequence-add-row">
            <select
              defaultValue=""
              onChange={(event) => {
                const value = event.target.value
                event.target.value = ''
                if (value) addStep(value)
              }}
            >
              <option value="">Select a component…</option>
              {available.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.label}
                </option>
              ))}
            </select>
            <Plus size={14} />
          </span>
        </label>
      )}
      {steps.length === 0 ? (
        <p className="code-link-hint">No sequence hops yet. Fill from an inner diagram or add components.</p>
      ) : (
        <ol className="sequence-flow-list">
          {steps.map((step, index) => {
            const location = locateSequenceStep(document, drillPath, integration, step)
            return (
              <li key={step.id} className="sequence-flow-item">
                <span className="sequence-flow-index">{index + 1}</span>
                <button
                  type="button"
                  className="sequence-flow-name"
                  title={location?.parentLabel ? `Open in ${location.parentLabel}` : 'Focus this component'}
                  onClick={() => onOpenHop(step)}
                >
                  {step.label}
                </button>
                <span className="sequence-flow-tools">
                  <button type="button" className="icon-btn" title="Move up" onClick={() => move(index, -1)} disabled={index === 0}>
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Move down"
                    onClick={() => move(index, 1)}
                    disabled={index === steps.length - 1}
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Remove hop"
                    onClick={() => onChange(steps.filter((item) => item.id !== step.id))}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {hasSubDiagramContent(integration.subDiagram) && (
        <p className="code-link-hint">
          <Layers size={12} /> This integration has its own sequence diagram with{' '}
          {integration.subDiagram?.systems.length ?? 0} components.
        </p>
      )}
    </div>
  )
}
