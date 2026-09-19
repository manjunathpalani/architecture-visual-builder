import { useRef } from 'react'
import { Database, Layers, PanelRight, PictureInPicture2, Scale, X, ZoomIn } from 'lucide-react'
import { ChangeDesignSection } from './ChangeDesignSection'
import {
  EDGE_PROPERTY_GROUPS,
  PropertyGroup,
  PropertyGroupToolbar,
  SYSTEM_PROPERTY_GROUPS,
  usePropertyGroups,
  type PropertyGroupId,
} from './PropertyGroup'
import type { Edge, Node } from '@xyflow/react'
import type {
  ArchitectureDocument,
  DiagramShape,
  DrawingShapeKind,
  EdgeRouting,
  IntegrationFrequency,
  IntegrationProtocol,
  SequenceFlowStep,
  SystemType,
  TechnicalChangeDesign,
} from '../types'
import {
  COLOR_PRESETS,
  DRAWING_SHAPE_KINDS,
  DRAWING_SHAPE_LABELS,
  ARROW_DIRECTION_OPTIONS,
  EDGE_ROUTING_OPTIONS,
  LINE_STYLE_OPTIONS,
  LINE_WEIGHT_OPTIONS,
  SYSTEM_TYPE_CONFIG,
  parseEdgeRouting,
  parseLineAnimation,
  parseLineStyle,
  parseLineWeight,
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
import { SequenceFlowSection } from './SequenceFlowSection'
import { RichNotesEditor } from './RichNotesEditor'
import { hasRichNotes } from '../utils/richNotes'
import { isApiIntegration, isApiNode } from '../utils/apiComponent'
import { hasCodeLink } from '../utils/codeLink'
import { tasksForSystem } from '../utils/changeDesign'
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
  selectedEdges?: Edge<IntegrationEdgeData>[]
  document: ArchitectureDocument
  drillPath: DiagramPath
  onUpdateNode: (id: string, data: Partial<IntegrationNodeData>) => void
  onUpdateEdge: (id: string, data: Partial<IntegrationEdgeData>) => void
  onUpdateEdges?: (ids: string[], data: Partial<IntegrationEdgeData>) => void
  onDeleteNode: (id: string) => void
  onDeleteEdge: (id: string) => void
  onDeleteEdges?: (ids: string[]) => void
  onDrillInto: (systemId: string, label: string, kind?: 'system' | 'integration') => void
  onOpenSequenceHop?: (edgeId: string, step: SequenceFlowStep) => void
  onAnalyzeCapability?: (label: string) => void
  onReadSaasMetadata?: () => void
  onOpenChangeDesign?: (systemId: string) => void
  onChangeDesigns?: (designs: TechnicalChangeDesign[]) => void
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
  selectedEdges,
  document,
  drillPath,
  onUpdateNode,
  onUpdateEdge,
  onUpdateEdges,
  onDeleteNode,
  onDeleteEdge,
  onDeleteEdges,
  onDrillInto,
  onOpenSequenceHop,
  onAnalyzeCapability,
  onReadSaasMetadata,
  onOpenChangeDesign,
  onChangeDesigns,
  variant = 'side',
  onDock,
  onUndock,
  onCloseFlyout,
}: PropertiesPanelProps) {
  const { isOpen, toggle, expandAll, mergeAll } = usePropertyGroups()
  const formRef = useRef<HTMLDivElement>(null)

  const expandGroups = (ids: PropertyGroupId[]) => {
    expandAll(ids)
    window.requestAnimationFrame(() => {
      const form = formRef.current
      if (!form) return
      const flyout = form.closest('.properties-flyout')
      const scroller = (flyout?.querySelector('.property-form') as HTMLElement | null) ?? form.closest('.palette-groups')
      if (scroller instanceof HTMLElement) scroller.scrollTop = 0
    })
  }
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
        <div className="property-form" ref={formRef}>
          {isShape && (
            <label className="shape-text-property">
              Text
              <textarea
                rows={4}
                value={data.label}
                placeholder="Type the text shown on this shape"
                onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
              />
              <span className="code-link-hint">Shown inside the shape. You can also double-click the shape on the canvas.</span>
            </label>
          )}
          <PropertyGroupToolbar
            onExpandAll={() => expandGroups(SYSTEM_PROPERTY_GROUPS)}
            onMergeAll={mergeAll}
          />

          {!isShape && (
          <PropertyGroup
            id="identity"
            title="Identity"
            summary={data.label}
            expanded={isOpen('identity')}
            onToggle={toggle}
          >
          <label>
            Name
            <input
              value={data.label}
              onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
            />
          </label>
          </PropertyGroup>
          )}

          <PropertyGroup
            id="appearance"
            title="Appearance"
            summary={parseNodeDisplay(data.properties) === 'icon' ? 'Icon' : 'Box'}
            expanded={isOpen('appearance')}
            onToggle={toggle}
          >
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
          </PropertyGroup>

          <PropertyGroup
            id="details"
            title="Details"
            summary={data.category || data.systemType}
            expanded={isOpen('details')}
            onToggle={toggle}
          >
          {isNote && (
            <RichNotesEditor
              label="Note content"
              value={data.properties.content ?? data.label}
              placeholder="Write this sticky note with headings, lists, and emphasis…"
              onChange={(content) =>
                onUpdateNode(selectedNode.id, {
                  properties: { ...data.properties, content },
                })
              }
            />
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
              rows={2}
              value={data.properties.description ?? ''}
              onChange={(e) =>
                onUpdateNode(selectedNode.id, {
                  properties: { ...data.properties, description: e.target.value },
                })
              }
            />
          </label>
          </PropertyGroup>

          {!isNote && (
          <PropertyGroup
            id="notes"
            title="Notes"
            summary={hasRichNotes(data.properties.notes) ? 'Has notes' : undefined}
            expanded={isOpen('notes')}
            onToggle={toggle}
          >
            <RichNotesEditor
              value={data.properties.notes ?? ''}
              placeholder="Design notes, constraints, open questions, and links…"
              onChange={(notes) =>
                onUpdateNode(selectedNode.id, {
                  properties: { ...data.properties, notes },
                })
              }
            />
          </PropertyGroup>
          )}

          {!isNote && (
          <PropertyGroup
            id="state"
            title="Architecture state"
            summary={CHANGE_STATUS_LABELS[parseChangeStatus(data.properties.changeStatus)]}
            expanded={isOpen('state')}
            onToggle={toggle}
          >
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
          </PropertyGroup>
          )}

          <PropertyGroup
            id="feature"
            title="Feature / apply"
            summary={
              tasksForSystem(document, selectedNode.id).length > 0
                ? `${tasksForSystem(document, selectedNode.id).length} work item${tasksForSystem(document, selectedNode.id).length === 1 ? '' : 's'}`
                : undefined
            }
            expanded={isOpen('feature')}
            onToggle={toggle}
          >
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

          {!isGroup && !isShape && !isNote && onOpenChangeDesign && onChangeDesigns && (
            <ChangeDesignSection
              document={document}
              systemId={selectedNode.id}
              onChangeDesigns={onChangeDesigns}
              onOpenDesign={onOpenChangeDesign}
            />
          )}
          </PropertyGroup>

          <PropertyGroup
            id="links"
            title="Code & work items"
            summary={hasCodeLink(data.properties) ? 'Linked' : undefined}
            expanded={isOpen('links')}
            onToggle={toggle}
          >
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
          </PropertyGroup>

          <PropertyGroup
            id="structure"
            title="Internal diagram"
            expanded={isOpen('structure')}
            onToggle={toggle}
          >
          {(() => {
            const system = findSystemAtPath(document, drillPath, selectedNode.id)
            if (!system || !canDrillInto(system)) return <p className="code-link-hint">No inner diagram for this item.</p>
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
          </PropertyGroup>

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
    const bulkEdgeIds =
      !selectedNode && (selectedEdges?.length ?? 0) > 1
        ? selectedEdges!.map((edge) => edge.id)
        : [selectedEdge.id]
    const bulkEdges = bulkEdgeIds.length > 1
    const patchEdge = (patch: Partial<IntegrationEdgeData>) => {
      if (bulkEdges && onUpdateEdges) onUpdateEdges(bulkEdgeIds, patch)
      else onUpdateEdge(selectedEdge.id, patch)
    }
    return (
      <aside className={`properties ${variant === 'flyout' ? 'is-flyout' : ''}`}>
        <div className="panel-header">
          <div>
            <h2>{bulkEdges ? `${bulkEdgeIds.length} integrations` : 'Integration Properties'}</h2>
            <p>{bulkEdges ? 'Shared properties — changes apply to all selected' : data.label}</p>
          </div>
          {headerActions}
        </div>
        <div className="property-form" ref={formRef}>
          {bulkEdges && (
            <p className="code-link-hint">
              Colour, protocol, frequency, line style, and arrows update every selected integration together.
            </p>
          )}
          <PropertyGroupToolbar
            onExpandAll={() => expandGroups(EDGE_PROPERTY_GROUPS)}
            onMergeAll={mergeAll}
          />
          {!bulkEdges && (
          <PropertyGroup
            id="identity"
            title="Identity"
            summary={data.label}
            expanded={isOpen('identity')}
            onToggle={toggle}
          >
          <label>
            Integration Name
            <input
              value={data.label}
              onChange={(e) => patchEdge({ label: e.target.value })}
            />
          </label>
          </PropertyGroup>
          )}
          <PropertyGroup
            id="line"
            title="Line & arrows"
            summary={[
              EDGE_ROUTING_OPTIONS.find((option) => option.id === parseEdgeRouting(data.routing))?.label,
              data.color ? 'custom color' : null,
              parseLineAnimation(data.lineAnimation) ? 'animated' : 'animation off',
            ]
              .filter(Boolean)
              .join(' · ')}
            expanded={isOpen('line')}
            onToggle={toggle}
          >
          <div className="color-picker-section">
            <span className="color-picker-label">Line color</span>
            <p className="code-link-hint">Shown on this integration regardless of the canvas Flow color mode.</p>
            <div className="color-presets">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch ${data.color === color ? 'active' : ''}`}
                  style={{ background: color }}
                  title={color}
                  onClick={() => patchEdge({ color })}
                />
              ))}
            </div>
            <div className="color-custom">
              <input
                type="color"
                value={data.color ?? '#6366f1'}
                onChange={(e) => patchEdge({ color: e.target.value })}
              />
              <button
                type="button"
                className="btn-reset-color"
                onClick={() => patchEdge({ color: undefined })}
              >
                Reset default
              </button>
            </div>
          </div>
          <div className="arrow-direction-section">
            <span className="color-picker-label">Line style</span>
            <div className="arrow-direction-grid line-weight-grid">
              {LINE_STYLE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`arrow-direction-btn ${parseLineStyle(data.lineStyle) === option.id ? 'active' : ''}`}
                  title={option.hint}
                  onClick={() => patchEdge({ lineStyle: option.id })}
                >
                  <strong className={`line-style-preview style-${option.id}`} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="arrow-direction-section">
            <span className="color-picker-label">Line animation</span>
            <div className="arrow-direction-grid line-weight-grid">
              <button
                type="button"
                className={`arrow-direction-btn ${parseLineAnimation(data.lineAnimation) ? 'active' : ''}`}
                title="Moving dots along this integration"
                onClick={() => patchEdge({ lineAnimation: true })}
              >
                <span>On</span>
              </button>
              <button
                type="button"
                className={`arrow-direction-btn ${parseLineAnimation(data.lineAnimation) ? '' : 'active'}`}
                title="Show a static line with no moving dots"
                onClick={() => patchEdge({ lineAnimation: false })}
              >
                <span>Off</span>
              </button>
            </div>
            <span className="code-link-hint">
              Moving dots follow the arrow direction. Turn off for a static line.
              {data.canvasLineAnimation === false ? ' All line animation is currently off in Tools.' : ''}
            </span>
          </div>
          <div className="arrow-direction-section">
            <span className="color-picker-label">Line thickness</span>
            <div className="arrow-direction-grid line-weight-grid">
              {LINE_WEIGHT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`arrow-direction-btn ${parseLineWeight(data.lineWeight) === option.id ? 'active' : ''}`}
                  onClick={() => patchEdge({ lineWeight: option.id })}
                >
                  <strong className={`line-weight-preview weight-${option.id}`} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          <label>
            Line routing
            <select
              value={parseEdgeRouting(data.routing)}
              onChange={(e) =>
                patchEdge({
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
              Drag the curved line to move it. Drag a connector end to another port. Drag the dots to bend it.
            </span>
          </label>
          {(data.waypoints?.length ?? 0) > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => patchEdge({ waypoints: [] })}
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
                    patchEdge({ direction: option.id })
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
                patchEdge({
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
          </PropertyGroup>
          {!bulkEdges && (
          <PropertyGroup
            id="notes"
            title="Notes"
            summary={hasRichNotes(data.notes) ? 'Has notes' : undefined}
            expanded={isOpen('notes')}
            onToggle={toggle}
          >
            <RichNotesEditor
              value={data.notes ?? ''}
              placeholder="Notes for this integration: contracts, SLAs, exceptions, links…"
              onChange={(notes) => patchEdge({ notes })}
            />
          </PropertyGroup>
          )}
          {!bulkEdges && (
          <PropertyGroup
            id="sequence"
            title="Sequence flow"
            summary={
              (data.sequenceFlow?.length ?? 0) > 0
                ? `${data.sequenceFlow?.length} hops`
                : data.subDiagram
                  ? 'sequence diagram'
                  : undefined
            }
            expanded={isOpen('sequence')}
            onToggle={toggle}
          >
            <SequenceFlowSection
              document={document}
              drillPath={drillPath}
              integration={{
                id: selectedEdge.id,
                source: selectedEdge.source,
                target: selectedEdge.target,
                label: data.label,
                direction: data.direction,
                protocol: data.protocol,
                frequency: data.frequency,
                sequenceFlow: data.sequenceFlow,
                subDiagram: data.subDiagram,
              }}
              onChange={(sequenceFlow) => patchEdge({ sequenceFlow })}
              onOpenSequenceDiagram={() => onDrillInto(selectedEdge.id, data.label, 'integration')}
              onOpenHop={(step) => onOpenSequenceHop?.(selectedEdge.id, step)}
            />
          </PropertyGroup>
          )}
          <PropertyGroup
            id="spec"
            title="Contract"
            summary={data.protocol}
            expanded={isOpen('spec')}
            onToggle={toggle}
          >
          <label>
            Protocol
            <select
              value={data.protocol}
              onChange={(e) =>
                patchEdge({
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
                patchEdge({
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
              onChange={(e) => patchEdge({ dataFormat: e.target.value })}
            />
          </label>
          {!bulkEdges && (
          <label>
            Description
            <textarea
              rows={2}
              value={data.description}
              onChange={(e) => patchEdge({ description: e.target.value })}
            />
          </label>
          )}

          <label>
            Architecture state
            <select
              value={parseChangeStatus(data.changeStatus)}
              onChange={(e) =>
                patchEdge({ changeStatus: e.target.value as ChangeStatus })
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

          {!bulkEdges && (isApiIntegration(data) || data.interfaceSpec) && (
            <InterfaceSpecSection
              interfaceSpecJson={data.interfaceSpec}
              defaultTitle={data.label}
              onChange={(json) =>
                patchEdge({ interfaceSpec: json || undefined })
              }
            />
          )}

          {!bulkEdges && (
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
            onChange={(fields) => patchEdge({ ...fields })}
          />
          )}
          </PropertyGroup>

          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              if (bulkEdges && onDeleteEdges) onDeleteEdges(bulkEdgeIds)
              else onDeleteEdge(selectedEdge.id)
            }}
          >
            {bulkEdges ? `Delete ${bulkEdgeIds.length} integrations` : 'Delete Integration'}
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
    lineStyle: integration.lineStyle,
    lineWeight: integration.lineWeight,
    lineAnimation: parseLineAnimation(integration.lineAnimation),
    sequenceFlow: integration.sequenceFlow,
    subDiagram: integration.subDiagram,
    notes: integration.notes,
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