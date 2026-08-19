import { Layers, ZoomIn } from 'lucide-react'
import type { Edge, Node } from '@xyflow/react'
import type {
  ArchitectureDocument,
  DiagramShape,
  DrawingShapeKind,
  IntegrationDirection,
  IntegrationFrequency,
  IntegrationProtocol,
  SystemType,
} from '../types'
import { COLOR_PRESETS, DRAWING_SHAPE_KINDS, DRAWING_SHAPE_LABELS, SYSTEM_TYPE_CONFIG } from '../types'
import type { DiagramPath } from '../types/diagram'
import { getNodeColor } from '../utils/nodeStyle'
import type { IntegrationEdgeData, IntegrationNodeData } from '../utils/jsonIO'
import {
  canDrillInto,
  findSystemAtPath,
  getSubDiagramStats,
  hasSubDiagram,
} from '../utils/diagramNavigation'
import { CodeLinkSection } from './CodeLinkSection'
import { InterfaceSpecSection } from './InterfaceSpecSection'
import { isApiIntegration, isApiNode } from '../utils/apiComponent'
import {
  CHANGE_STATUS_HINTS,
  CHANGE_STATUS_LABELS,
  CHANGE_STATUSES,
  parseChangeStatus,
  type ChangeStatus,
} from '../utils/architectureState'

interface PropertiesPanelProps {
  selectedNode: Node<IntegrationNodeData> | null
  selectedEdge: Edge<IntegrationEdgeData> | null
  document: ArchitectureDocument
  drillPath: DiagramPath
  onUpdateNode: (id: string, data: Partial<IntegrationNodeData>) => void
  onUpdateEdge: (id: string, data: Partial<IntegrationEdgeData>) => void
  onDeleteNode: (id: string) => void
  onDeleteEdge: (id: string) => void
  onDrillInto: (systemId: string, label: string) => void
}

const SYSTEM_TYPES = Object.keys(SYSTEM_TYPE_CONFIG) as SystemType[]
const DIRECTIONS: IntegrationDirection[] = ['inbound', 'outbound', 'bidirectional']
const PROTOCOLS: IntegrationProtocol[] = [
  'REST API', 'SOAP', 'GraphQL', 'SFTP', 'Kafka', 'MQTT',
  'Webhook', 'ODBC/JDBC', 'File Transfer', 'Custom',
]
const FREQUENCIES: IntegrationFrequency[] = [
  'real-time', 'near-real-time', 'batch', 'event-driven', 'scheduled',
]
const DIAGRAM_SHAPES: DiagramShape[] = [
  'actor', 'class', 'interface', 'component', 'process', 'decision',
  'package', 'datastore', 'queue', 'c4-person', 'c4-system', 'c4-container',
]

export function PropertiesPanel({
  selectedNode,
  selectedEdge,
  document,
  drillPath,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
  onDrillInto,
}: PropertiesPanelProps) {
  if (!selectedNode && !selectedEdge) {
    return (
      <aside className="properties empty">
        <div className="panel-header">
          <h2>Properties</h2>
          <p>Select a system or integration to edit</p>
        </div>
        <div className="empty-state">
          <p>Click any node or connection on the canvas to view and edit its details.</p>
        </div>
      </aside>
    )
  }

  if (selectedNode) {
    const data = selectedNode.data
    const isDiagram = data.systemType === 'diagram'
    const isNote = data.systemType === 'note'
    const isGroup = data.systemType === 'group'
    const isShape = data.systemType === 'shape'
    const panelTitle = isDiagram
      ? 'Diagram Properties'
      : isNote
        ? 'Note Properties'
        : isGroup
          ? 'Zone Properties'
          : isShape
            ? 'Shape Properties'
            : 'System Properties'

    return (
      <aside className="properties">
        <div className="panel-header">
          <h2>{panelTitle}</h2>
          <p>{data.label}</p>
        </div>
        <div className="property-form">
          <label>
            Name
            <input
              value={data.label}
              onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
            />
          </label>

          <div className="color-picker-section">
            <span className="color-picker-label">Color</span>
            <div className="color-presets">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch ${data.properties.color === color ? 'active' : ''}`}
                  style={{ background: color }}
                  title={color}
                  onClick={() =>
                    onUpdateNode(selectedNode.id, {
                      properties: { ...data.properties, color },
                    })
                  }
                />
              ))}
            </div>
            <div className="color-custom">
              <input
                type="color"
                value={data.properties.color ?? getNodeColor(data)}
                onChange={(e) =>
                  onUpdateNode(selectedNode.id, {
                    properties: { ...data.properties, color: e.target.value },
                  })
                }
              />
              <button
                type="button"
                className="btn-reset-color"
                onClick={() =>
                  onUpdateNode(selectedNode.id, {
                    properties: { ...data.properties, color: undefined },
                  })
                }
              >
                Reset default
              </button>
            </div>
          </div>

          {isDiagram && (
            <label>
              Diagram Shape
              <select
                value={data.properties.shape ?? 'process'}
                onChange={(e) =>
                  onUpdateNode(selectedNode.id, {
                    properties: { ...data.properties, shape: e.target.value },
                  })
                }
              >
                {DIAGRAM_SHAPES.map((shape) => (
                  <option key={shape} value={shape}>
                    {shape}
                  </option>
                ))}
              </select>
            </label>
          )}

          {isShape && (
            <label>
              Geometry
              <select
                value={(data.properties.shape as DrawingShapeKind) ?? 'rectangle'}
                onChange={(e) =>
                  onUpdateNode(selectedNode.id, {
                    properties: { ...data.properties, shape: e.target.value },
                  })
                }
              >
                {DRAWING_SHAPE_KINDS.map((shape) => (
                  <option key={shape} value={shape}>
                    {DRAWING_SHAPE_LABELS[shape]}
                  </option>
                ))}
              </select>
            </label>
          )}

          {isNote && (
            <label>
              Note Content
              <textarea
                rows={5}
                value={data.properties.content ?? data.label}
                onChange={(e) =>
                  onUpdateNode(selectedNode.id, {
                    properties: { ...data.properties, content: e.target.value },
                  })
                }
              />
            </label>
          )}

          {!isDiagram && !isNote && !isGroup && !isShape && (
            <>
              <label>
                Type
                <select
                  value={data.systemType}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, { systemType: e.target.value as SystemType })
                  }
                >
                  {SYSTEM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {SYSTEM_TYPE_CONFIG[type].label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <input
                  value={data.category}
                  onChange={(e) => onUpdateNode(selectedNode.id, { category: e.target.value })}
                />
              </label>
              <label>
                Vendor
                <input
                  value={data.properties.vendor ?? ''}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, {
                      properties: { ...data.properties, vendor: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                Service
                <input
                  value={data.properties.service ?? ''}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, {
                      properties: { ...data.properties, service: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                Environment
                <input
                  value={data.properties.environment ?? ''}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, {
                      properties: { ...data.properties, environment: e.target.value },
                    })
                  }
                />
              </label>
            </>
          )}

          <label>
            Description
            <textarea
              rows={3}
              value={data.properties.description ?? ''}
              onChange={(e) =>
                onUpdateNode(selectedNode.id, {
                  properties: { ...data.properties, description: e.target.value },
                })
              }
            />
          </label>

          {!isNote && (
            <label>
              Architecture state
              <select
                value={parseChangeStatus(data.properties.changeStatus)}
                onChange={(e) =>
                  onUpdateNode(selectedNode.id, {
                    properties: { ...data.properties, changeStatus: e.target.value },
                  })
                }
              >
                {CHANGE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {CHANGE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <span className="code-link-hint">
                {CHANGE_STATUS_HINTS[parseChangeStatus(data.properties.changeStatus)]}
              </span>
            </label>
          )}

          {(isApiNode(data) || data.properties.interfaceSpec) && (
            <InterfaceSpecSection
              interfaceSpecJson={data.properties.interfaceSpec}
              defaultTitle={data.label}
              onChange={(json) =>
                onUpdateNode(selectedNode.id, {
                  properties: { ...data.properties, interfaceSpec: json || undefined },
                })
              }
            />
          )}

          {!isGroup && !isShape && !isNote && (
            <CodeLinkSection
              properties={data.properties}
              onChange={(props) =>
                onUpdateNode(selectedNode.id, { properties: props })
              }
            />
          )}

          {(() => {
            const system = findSystemAtPath(document, drillPath, selectedNode.id)
            if (!system || !canDrillInto(system)) return null
            const stats = getSubDiagramStats(system)
            const hasContent = hasSubDiagram(system)
            return (
              <div className="sub-diagram-section">
                <div className="sub-diagram-header">
                  <Layers size={16} />
                  <span>Internal Diagram</span>
                </div>
                <p className="sub-diagram-desc">
                  {hasContent
                    ? `Contains ${stats.systems} component${stats.systems !== 1 ? 's' : ''} and ${stats.integrations} integration${stats.integrations !== 1 ? 's' : ''} inside.`
                    : 'No internal detail yet. Open to design the component’s inner architecture.'}
                </p>
                <button
                  type="button"
                  className="btn-secondary sub-diagram-open-btn"
                  onClick={() => onDrillInto(selectedNode.id, data.label)}
                >
                  <ZoomIn size={16} />
                  {hasContent ? 'Open Sub-Diagram' : 'Create & Open Sub-Diagram'}
                </button>
              </div>
            )
          })()}

          <button
            type="button"
            className="btn-danger"
            onClick={() => onDeleteNode(selectedNode.id)}
          >
            Delete
          </button>
        </div>
      </aside>
    )
  }

  if (selectedEdge) {
    const data = selectedEdge.data!
    return (
      <aside className="properties">
        <div className="panel-header">
          <h2>Integration Properties</h2>
          <p>{data.label}</p>
        </div>
        <div className="property-form">
          <label>
            Integration Name
            <input
              value={data.label}
              onChange={(e) => onUpdateEdge(selectedEdge.id, { label: e.target.value })}
            />
          </label>
          <label>
            Direction
            <select
              value={data.direction}
              onChange={(e) =>
                onUpdateEdge(selectedEdge.id, {
                  direction: e.target.value as IntegrationDirection,
                })
              }
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            Protocol
            <select
              value={data.protocol}
              onChange={(e) =>
                onUpdateEdge(selectedEdge.id, {
                  protocol: e.target.value as IntegrationProtocol,
                })
              }
            >
              {PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label>
            Frequency
            <select
              value={data.frequency}
              onChange={(e) =>
                onUpdateEdge(selectedEdge.id, {
                  frequency: e.target.value as IntegrationFrequency,
                })
              }
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data Format
            <input
              value={data.dataFormat}
              onChange={(e) => onUpdateEdge(selectedEdge.id, { dataFormat: e.target.value })}
            />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={data.description}
              onChange={(e) => onUpdateEdge(selectedEdge.id, { description: e.target.value })}
            />
          </label>

          <label>
            Architecture state
            <select
              value={parseChangeStatus(data.changeStatus)}
              onChange={(e) =>
                onUpdateEdge(selectedEdge.id, { changeStatus: e.target.value as ChangeStatus })
              }
            >
              {CHANGE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CHANGE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <span className="code-link-hint">
              {CHANGE_STATUS_HINTS[parseChangeStatus(data.changeStatus)]}
            </span>
          </label>

          <div className="color-picker-section">
            <span className="color-picker-label">Flow color</span>
            <p className="code-link-hint">Used when Flow color is set to Custom on the canvas.</p>
            <div className="color-presets">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch ${data.color === color ? 'active' : ''}`}
                  style={{ background: color }}
                  title={color}
                  onClick={() => onUpdateEdge(selectedEdge.id, { color })}
                />
              ))}
            </div>
            <div className="color-custom">
              <input
                type="color"
                value={data.color ?? '#6366f1'}
                onChange={(e) => onUpdateEdge(selectedEdge.id, { color: e.target.value })}
              />
              <button
                type="button"
                className="btn-reset-color"
                onClick={() => onUpdateEdge(selectedEdge.id, { color: undefined })}
              >
                Reset default
              </button>
            </div>
          </div>

          {(isApiIntegration(data) || data.interfaceSpec) && (
            <InterfaceSpecSection
              interfaceSpecJson={data.interfaceSpec}
              defaultTitle={data.label}
              onChange={(json) =>
                onUpdateEdge(selectedEdge.id, { interfaceSpec: json || undefined })
              }
            />
          )}

          <button
            type="button"
            className="btn-danger"
            onClick={() => onDeleteEdge(selectedEdge.id)}
          >
            Delete Integration
          </button>
        </div>
      </aside>
    )
  }

  return null
}