import type { Node } from '@xyflow/react'
import type { ArchitectureDocument, SystemProperties } from '../types'
import { COLOR_PRESETS } from '../types'
import type { DiagramPath } from '../types/diagram'
import type { IntegrationNodeData } from '../utils/jsonIO'
import {
  PROPERTY_COHORT_LABEL,
  propertyCohort,
  type PropertyCohort,
} from '../utils/bulkSelection'
import { getNodeColor } from '../utils/nodeStyle'
import {
  NODE_FONT_DEFAULT,
  NODE_FONT_FAMILIES,
  NODE_FONT_MAX,
  NODE_FONT_MIN,
  NODE_FONT_WEIGHTS,
  parseNodeFontFamily,
  parseNodeFontSize,
  parseNodeFontStyle,
  parseNodeFontWeight,
} from '../utils/nodeFontSize'
import {
  CHANGE_STATUS_LABELS,
  CHANGE_STATUSES,
  parseChangeStatus,
  type ChangeStatus,
} from '../utils/architectureState'
import { findSystemAtPath } from '../utils/diagramNavigation'

interface BulkPropertiesProps {
  nodes: Node<IntegrationNodeData>[]
  document: ArchitectureDocument
  drillPath: DiagramPath
  onUpdateNodes: (ids: string[], data: Partial<IntegrationNodeData>) => void
}

export function BulkProperties({ nodes, document, drillPath, onUpdateNodes }: BulkPropertiesProps) {
  const cohort = propertyCohort(nodes[0]?.data.systemType ?? 'saas')
  const records = nodes.map((node) => ({
    id: node.id,
    properties: findSystemAtPath(document, drillPath, node.id)?.properties ?? node.data.properties ?? {},
  }))
  const ids = records.map((item) => item.id)
  const patch = (properties: Partial<SystemProperties>) => {
    onUpdateNodes(ids, { properties: properties as IntegrationNodeData['properties'] })
  }
  const fontFamily = shared(records.map((item) => parseNodeFontFamily(item.properties)))
  const fontSize = shared(records.map((item) => parseNodeFontSize(item.properties)))
  const fontWeight = shared(records.map((item) => parseNodeFontWeight(item.properties)))
  const fontStyle = shared(records.map((item) => parseNodeFontStyle(item.properties)))
  const textColor = shared(records.map((item) => item.properties.textColor ?? ''))
  const color = shared(records.map((item) => item.properties.color ?? ''))
  const changeStatus = shared(records.map((item) => parseChangeStatus(item.properties.changeStatus)))
  const label = PROPERTY_COHORT_LABEL[cohort]

  return (
    <div className="property-form">
      <p className="code-link-hint">
        {ids.length} {label} are highlighted because they can take the same change. Other items stay unselected.
        Name, type, and links are left on each item.
      </p>
      <div className="font-style-section">
        <span className="color-picker-label">Text style</span>
        <label>
          Font
          <select
            value={fontFamily ?? ''}
            onChange={(event) =>
              patch({ fontFamily: event.target.value === 'default' ? undefined : event.target.value })
            }
          >
            {fontFamily == null && <option value="">Mixed</option>}
            {NODE_FONT_FAMILIES.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
        </label>
        <label className="font-size-field">
          Size
          <div className="font-size-row">
            <input
              type="range"
              min={NODE_FONT_MIN}
              max={NODE_FONT_MAX}
              value={fontSize ?? NODE_FONT_DEFAULT}
              onChange={(event) => patch({ fontSize: event.target.value })}
            />
            <span className="font-size-value">{fontSize == null ? 'Mixed' : `${fontSize}px`}</span>
          </div>
        </label>
        <div className="font-style-toggles">
          {NODE_FONT_WEIGHTS.map((weight) => (
            <button
              key={weight.id}
              type="button"
              className={`font-size-preset ${fontWeight === weight.id ? 'active' : ''}`}
              style={{ fontWeight: Number(weight.id) }}
              onClick={() => patch({ fontWeight: weight.id === '600' ? undefined : weight.id })}
            >
              {weight.label}
            </button>
          ))}
          <button
            type="button"
            className={`font-size-preset ${fontStyle === 'italic' ? 'active' : ''}`}
            style={{ fontStyle: 'italic' }}
            onClick={() => patch({ fontStyle: fontStyle === 'italic' ? undefined : 'italic' })}
          >
            Italic
          </button>
        </div>
        <ColorRow
          label="Text color"
          value={textColor}
          fallback="#0f172a"
          onChange={(next) => patch({ textColor: next })}
        />
      </div>
      <ColorRow
        label="Color"
        value={color}
        fallback={getNodeColor({ ...nodes[0].data, properties: records[0].properties })}
        onChange={(next) => patch({ color: next })}
      />
      {(cohort === 'system' || cohort === 'diagram') && (
        <label>
          Change status
          <select
            value={changeStatus ?? ''}
            onChange={(event) => patch({ changeStatus: event.target.value as ChangeStatus })}
          >
            {changeStatus == null && <option value="">Mixed</option>}
            {CHANGE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {CHANGE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

function ColorRow({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value: string | undefined
  fallback: string
  onChange: (color: string | undefined) => void
}) {
  return (
    <div className="color-picker-section">
      <span className="color-picker-label">{label}{value == null ? ' (mixed)' : ''}</span>
      <div className="color-presets">
        {COLOR_PRESETS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={`color-swatch ${value === swatch ? 'active' : ''}`}
            style={{ background: swatch }}
            title={swatch}
            onClick={() => onChange(swatch)}
          />
        ))}
      </div>
      <div className="color-custom">
        <input type="color" value={value || fallback} onChange={(event) => onChange(event.target.value)} />
        <button type="button" className="btn-reset-color" onClick={() => onChange(undefined)}>
          Reset default
        </button>
      </div>
    </div>
  )
}

function shared<T>(values: T[]): T | undefined {
  if (values.length === 0) return undefined
  const first = values[0]
  return values.every((value) => value === first) ? first : undefined
}

export function cohortTitle(cohort: PropertyCohort, count: number): string {
  const name = PROPERTY_COHORT_LABEL[cohort]
  return `${count} ${name}`
}
