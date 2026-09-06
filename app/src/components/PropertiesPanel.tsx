import { Database, Layers, PanelRight, PictureInPicture2, Scale, X, ZoomIn } from 'lucide-react'
import type { Edge, Node } from '@xyflow/react'
import type {
  ArchitectureDocument,
  DiagramShape,
  DrawingShapeKind,
  EdgeRouting,
  IntegrationFrequency,
  IntegrationProtocol,
  SystemType,
} from '../types'
import {
  COLOR_PRESETS,
  DRAWING_SHAPE_KINDS,
  DRAWING_SHAPE_LABELS,
  ARROW_DIRECTION_OPTIONS,
  EDGE_ROUTING_OPTIONS,
  SYSTEM_TYPE_CONFIG,
  parseEdgeRouting,
} from '../types'
import type { DiagramPath } from '../types/diagram'
import { getNodeColor, parseNodeDisplay, sizeForNodeDisplay, type NodeDisplayStyle } from '../utils/nodeStyle'
import type { IntegrationEdgeData, IntegrationNodeData } from '../utils/jsonIO'
import {
  canDrillInto,
  findSystemAtPath,
  getDiagramView,
  getSubDiagramStats,
  hasSubDiagram,
} from '../utils/diagramNavigation'
import { CodeLinkSection } from './CodeLinkSection'
import { WorkItemLinkSection } from './WorkItemLinkSection'
import { InterfaceSpecSection } from './InterfaceSpecSection'
import { isApiIntegration, isApiNode } from '../utils/apiComponent'
import {
  CHANGE_STATUS_HINTS,
  CHANGE_STATUS_LABELS,
  CHANGE_STATUSES,
  parseChangeStatus,
  type ChangeStatus,
} from '../utils/architectureState'
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
  onAnalyzeCapability?: (label: string) => void
  onReadSaasMetadata?: () => void
  variant?: 'side' | 'flyout'
  onDock?: () => void
  onUndock?: () => void
  onCloseFlyout?: () => void
}

const SYSTEM_TYPES = Object.keys(SYSTEM_TYPE_CONFIG) as SystemType[]
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
  onAnalyzeCapability,
  onReadSaasMetadata,
  variant = 'side',
  onDock,
  onUndock,
  onCloseFlyout,
}: PropertiesPanelProps) {
  const headerActions = (onDock || onUndock || onCloseFlyout) && (
    <div className="properties-header-actions">
      {onUndock && (
        <button type="button" className="icon-btn" title="Show next to component" onClick={onUndock}>
          <PictureInPicture2 size={16} />
        </button>
      )}
      {onDock && (
        <button type="button" className="icon-btn" title="Dock to side panel" onClick={onDock}>
          <PanelRight size={16} />
        </button>
      )}
      {onCloseFlyout && (
        <button type="button" className="icon-btn" title="Close" onClick={onCloseFlyout} aria-label="Close properties">
          <X size={16} />
        </button>
      )}
    </div>
  )

  if (!selectedNode && !selectedEdge) {
    if (variant === 'flyout') return null
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
    const data = liveNodeData(document, drillPath, selectedNode)
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
      <aside className={`properties ${variant === 'flyout' ? 'is-flyout' : ''}`}>
        <div className="panel-header">
          <div>
            <h2>{panelTitle}</h2>
            <p>{data.label}</p>
          </div>
          {headerActions}
        </div>
        <div className="property-form">
          <label>
            Name
            <input
              value={data.label}
              onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
            />
          </label>

          {!isNote && !isGroup && !isShape && (
            <div className="node-display-section">
              <span className="color-picker-label">Appearance</span>
              <div className="node-display-toggle">
                {([
                  { id: 'box', label: 'Box', hint: 'Card with border and details' },
                  { id: 'icon', label: 'Icon', hint: 'Icon and name only, no box' },
                ] as Array<{ id: NodeDisplayStyle; label: string; hint: string }>).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    title={option.hint}
                    className={`font-size-preset ${parseNodeDisplay(data.properties) === option.id ? 'active' : ''}`}
                    onClick={() =>
                      onUpdateNode(selectedNode.id, {
                        properties: {
                          ...data.properties,
                          display: option.id === 'box' ? undefined : option.id,
                          ...sizeForNodeDisplay(option.id, data.properties),
                        },
                      })
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="code-link-hint">
                Icon shows just the component symbol and name. Switch back to Box for the full card.
              </p>
            </div>
          )}

          <div className="font-style-section">
            <span className="color-picker-label">Text style</span>
            <label>
              Font
              <select
                value={parseNodeFontFamily(data.properties)}
                onChange={(e) =>
                  onUpdateNode(selectedNode.id, {
                    properties: {
                      ...data.properties,
                      fontFamily: e.target.value === 'default' ? undefined : e.target.value,
                    },
                  })
                }
              >
                {NODE_FONT_FAMILIES.map((font) => (
                  <option key={font.id} value={font.id} style={{ fontFamily: font.css }}>
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
                  value={parseNodeFontSize(data.properties)}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, {
                      properties: { ...data.properties, fontSize: e.target.value },
                    })
                  }
                />
                <span className="font-size-value">{parseNodeFontSize(data.properties)}px</span>
              </div>
              <div className="font-size-presets">
                {[
                  { label: 'Small', size: 10 },
                  { label: 'Default', size: NODE_FONT_DEFAULT },
                  { label: 'Large', size: 18 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`font-size-preset ${parseNodeFontSize(data.properties) === preset.size ? 'active' : ''}`}
                    onClick={() =>
                      onUpdateNode(selectedNode.id, {
                        properties: {
                          ...data.properties,
                          fontSize: preset.size === NODE_FONT_DEFAULT ? undefined : String(preset.size),
                        },
                      })
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </label>
            <div className="font-style-toggles">
              {NODE_FONT_WEIGHTS.map((weight) => (
                <button
                  key={weight.id}
                  type="button"
                  className={`font-size-preset ${parseNodeFontWeight(data.properties) === weight.id ? 'active' : ''}`}
                  style={{ fontWeight: Number(weight.id) }}
                  onClick={() =>
                    onUpdateNode(selectedNode.id, {
                      properties: {
                        ...data.properties,
                        fontWeight: weight.id === '600' ? undefined : weight.id,
                      },
                    })
                  }
                >
                  {weight.label}
                </button>
              ))}
              <button
                type="button"
                className={`font-size-preset ${parseNodeFontStyle(data.properties) === 'italic' ? 'active' : ''}`}
                style={{ fontStyle: 'italic' }}
                onClick={() =>
                  onUpdateNode(selectedNode.id, {
                    properties: {
                      ...data.properties,
                      fontStyle: parseNodeFontStyle(data.properties) === 'italic' ? undefined : 'italic',
                    },
                  })
                }
              >
                Italic
              </button>
            </div>
            <div className="color-picker-section">
              <span className="color-picker-label">Text color</span>
              <div className="color-presets">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch ${data.properties.textColor === color ? 'active' : ''}`}
                    style={{ background: color }}
                    title={color}
                    onClick={() =>
                      onUpdateNode(selectedNode.id, {
                        properties: { ...data.properties, textColor: color },
                      })
                    }
                  />
                ))}
              </div>
              <div className="color-custom">
                <input
                  type="color"
                  value={data.properties.textColor ?? '#0f172a'}
                  onChange={(e) =>
                    onUpdateNode(selectedNode.id, {
                      properties: { ...data.properties, textColor: e.target.value },
                    })
                  }
                />
                <button
                  type="button"
                  className="btn-reset-color"
                  onClick={() =>
                    onUpdateNode(selectedNode.id, {
                      properties: { ...data.properties, textColor: undefined },
                    })
                  }
                >
                  Reset default
                </button>
              </div>
            </div>
          </div>

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

          {(data.systemType === 'saas' || data.systemType === 'powerplatform') && onReadSaasMetadata && (
            <div className="sub-diagram-section">
              <div className="sub-diagram-header">
                <Database size={16} />
                <span>SaaS metadata</span>
              </div>
              <p className="sub-diagram-desc">
                Read tables and lookups from a Dynamics 365, Dataverse, or Salesforce instance and place them
                as this component’s data model.
              </p>
              <button
                type="button"
                className="btn-secondary sub-diagram-open-btn"
                onClick={onReadSaasMetadata}
              >
                <Database size={16} />
                Read metadata from instance
              </button>
            </div>
          )}

          {!isGroup && !isShape && !isNote && onAnalyzeCapability && (
            <div className="sub-diagram-section">
              <div className="sub-diagram-header">
                <Scale size={16} />
                <span>Capability analysis</span>
              </div>
              <p className="sub-diagram-desc">
                Ask AI for pros and cons of this component in the current landscape.
              </p>
              <button
                type="button"
                className="btn-secondary sub-diagram-open-btn"
                onClick={() => onAnalyzeCapability(data.label)}
              >
                <Scale size={16} />
                Analyze with AI
              </button>
            </div>
          )}

          {!isGroup && !isShape && !isNote && (
            <>
              <CodeLinkSection
                properties={data.properties}
                onChange={(props) =>
                  onUpdateNode(selectedNode.id, { properties: props })
                }
              />
              <WorkItemLinkSection
                fields={data.properties}
                onChange={(fields) =>
                  onUpdateNode(selectedNode.id, {
                    properties: { ...data.properties, ...fields },
                  })
                }
              />
            </>
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
    const data = liveEdgeData(document, drillPath, selectedEdge)
    return (
      <aside className={`properties ${variant === 'flyout' ? 'is-flyout' : ''}`}>
        <div className="panel-header">
          <div>
            <h2>Integration Properties</h2>
            <p>{data.label}</p>
          </div>
          {headerActions}
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
            Line routing
            <select
              value={parseEdgeRouting(data.routing)}
              onChange={(e) =>
                onUpdateEdge(selectedEdge.id, {
                  routing: e.target.value as EdgeRouting,
                })
              }
            >
              {EDGE_ROUTING_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="code-link-hint">
              {EDGE_ROUTING_OPTIONS.find((option) => option.id === parseEdgeRouting(data.routing))?.hint}
              {' · '}
              Drag a connector end to another port. Drag the dots on the line to bend it.
            </span>
          </label>
          {(data.waypoints?.length ?? 0) > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onUpdateEdge(selectedEdge.id, { waypoints: [] })}
            >
              Reset bends
            </button>
          )}
          <div className="arrow-direction-section">
            <span className="color-picker-label">Arrow direction</span>
            <div className="arrow-direction-grid">
              {ARROW_DIRECTION_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`arrow-direction-btn ${data.direction === option.id ? 'active' : ''}`}
                  onClick={() =>
                    onUpdateEdge(selectedEdge.id, { direction: option.id })
                  }
                  title={option.hint}
                >
                  <strong>{option.symbol}</strong>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                onUpdateEdge(selectedEdge.id, {
                  direction:
                    data.direction === 'outbound'
                      ? 'inbound'
                      : data.direction === 'inbound'
                        ? 'outbound'
                        : 'outbound',
                })
              }
            >
              Reverse arrow
            </button>
            <span className="code-link-hint">
              Select the connector, then pick which way the arrow points. Reverse swaps source and target arrows.
            </span>
          </div>
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

          <WorkItemLinkSection
            fields={{
              jiraIssueKey: data.jiraIssueKey,
              jiraIssueSummary: data.jiraIssueSummary,
              jiraIssueUrl: data.jiraIssueUrl,
              adoProject: data.adoProject,
              adoWorkItemId: data.adoWorkItemId,
              adoWorkItemTitle: data.adoWorkItemTitle,
              adoWorkItemUrl: data.adoWorkItemUrl,
            }}
            onChange={(fields) => onUpdateEdge(selectedEdge.id, { ...fields })}
          />

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

function liveNodeData(
  document: ArchitectureDocument,
  drillPath: DiagramPath,
  node: Node<IntegrationNodeData>,
): IntegrationNodeData {
  const system = findSystemAtPath(document, drillPath, node.id)
  if (!system) return node.data
  return {
    ...node.data,
    systemType: system.type,
    label: system.label,
    category: system.category,
    properties: system.properties ?? {},
  }
}

function liveEdgeData(
  document: ArchitectureDocument,
  drillPath: DiagramPath,
  edge: Edge<IntegrationEdgeData>,
): IntegrationEdgeData {
  const current = edge.data as IntegrationEdgeData
  const integration = getDiagramView(document, drillPath).integrations.find((item) => item.id === edge.id)
  if (!integration) return current
  return {
    ...current,
    label: integration.label,
    direction: integration.direction,
    protocol: integration.protocol,
    frequency: integration.frequency,
    dataFormat: integration.dataFormat ?? '',
    description: integration.description ?? '',
    interfaceSpec: integration.interfaceSpec,
    color: integration.color,
    changeStatus: integration.changeStatus,
    routing: parseEdgeRouting(integration.routing),
    waypoints: integration.waypoints,
    jiraIssueKey: integration.jiraIssueKey,
    jiraIssueSummary: integration.jiraIssueSummary,
    jiraIssueUrl: integration.jiraIssueUrl,
    adoProject: integration.adoProject,
    adoWorkItemId: integration.adoWorkItemId,
    adoWorkItemTitle: integration.adoWorkItemTitle,
    adoWorkItemUrl: integration.adoWorkItemUrl,
  }
}