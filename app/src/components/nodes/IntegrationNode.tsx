import { NodeResizer, type NodeProps } from '@xyflow/react'
import { SYSTEM_TYPE_CONFIG } from '../../types'
import type { IntegrationNodeData } from '../../utils/jsonIO'
import { getNodeColor, parseNodeDisplay } from '../../utils/nodeStyle'
import { ServiceIcon, getServiceIconFromLabel } from '../icons/ServiceIcons'
import { CodeLinkBadge } from '../CodeLinkBadge'
import { FileCode } from 'lucide-react'
import { WorkItemBadge } from '../WorkItemBadge'
import { SubDiagramBadge } from '../SubDiagramBadge'
import { isApiNode, nodeHasInterfaceSpec } from '../../utils/apiComponent'
import { getSpecFromProperties } from '../../types/interfaceSpec'
import { useState } from 'react'
import { InterfaceSpecModal } from '../InterfaceSpecModal'
import { ChangeStatusBadge } from '../ChangeStatusBadge'
import { ChangeDesignBadge } from '../ChangeDesignBadge'
import { NotesBadge } from '../NotesBadge'
import { parseChangeStatus } from '../../utils/architectureState'
import { NodeConnectors } from './NodeConnectors'
import { parseNodeFontSize, withNodeFontSize } from '../../utils/nodeFontSize'
import { formatInfraSummary } from '../../utils/cloudInfrastructure'
import { useDiagramLock } from './diagramLockContext'
import { InlineNodeTitleEditor } from './InlineNodeTitleEditor'
import { useNodeTitleEdit } from './nodeTitleEditContext'

export function IntegrationNode({ id, data, selected, width, height }: NodeProps) {
  const layoutLocked = useDiagramLock()
  const { startEditing } = useNodeTitleEdit()
  const nodeData = data as IntegrationNodeData
  const config = SYSTEM_TYPE_CONFIG[nodeData.systemType]
  const color = getNodeColor(nodeData)
  const display = parseNodeDisplay(nodeData.properties)
  const isIcon = display === 'icon'
  const fontSize = parseNodeFontSize(nodeData.properties)
  const iconSize = isIcon
    ? Math.max(28, Math.min(64, Math.round(Math.min(Number(width) || 96, (Number(height) || 108) - 28) * 0.72)))
    : Math.max(14, Math.min(32, Math.round(fontSize * 2.1)))
  const fallbackIcon = getServiceIconFromLabel(nodeData.label, nodeData.systemType, iconSize)
  const hasServiceIcon = Boolean(nodeData.properties.service) || Boolean(fallbackIcon)
  const showApiSpec = !isIcon && isApiNode(nodeData) && nodeHasInterfaceSpec(nodeData)
  const spec = getSpecFromProperties(nodeData.properties)
  const [showSpecModal, setShowSpecModal] = useState(false)
  const changeStatus = parseChangeStatus(nodeData.properties.changeStatus)
  const infraSummary = formatInfraSummary(nodeData.properties)

  return (
    <>
      <InlineNodeTitleEditor nodeId={id} label={nodeData.label} />
      <NodeResizer
        minWidth={isIcon ? 56 : 72}
        minHeight={isIcon ? 64 : 44}
        isVisible={selected && !layoutLocked}
        lineClassName="resize-line"
        handleClassName="resize-handle"
      />
      <div
        className={`integration-node resizable-node display-${display} ${selected ? 'selected' : ''} ${nodeData.isFlowFocus ? 'flow-focus' : ''} ${nodeData.isFlowNeighbor ? 'flow-neighbor' : ''} ${nodeData.isFlowPath ? 'flow-path' : ''} ${nodeData.isFlowPlayCurrent ? 'flow-play-current' : ''} ${nodeData.showTouchPoints ? 'show-touch-points' : ''} change-${changeStatus} ${nodeData.isStateContext ? 'state-context' : ''}`}
        style={withNodeFontSize(nodeData.properties, { '--node-color': color } as React.CSSProperties)}
        title={
          isIcon
            ? `${nodeData.label} · ${config.label}${infraSummary ? ` · ${infraSummary}` : ''}`
            : infraSummary || undefined
        }
      >
        <NodeConnectors />
        {nodeData.hasSubDiagramContent && (
          <SubDiagramBadge
            nodeId={id}
            label={nodeData.label}
            systems={nodeData.subDiagramStats?.systems}
            integrations={nodeData.subDiagramStats?.integrations}
            compact={isIcon}
          />
        )}
        <div className="node-header">
          {hasServiceIcon ? (
            <div className="node-service-icon">
              {nodeData.properties.service ? (
                <ServiceIcon
                  vendor={nodeData.properties.vendor}
                  service={nodeData.properties.service}
                  size={iconSize}
                />
              ) : (
                fallbackIcon
              )}
            </div>
          ) : (
            <span className="node-emoji-icon" style={isIcon ? { fontSize: iconSize } : undefined}>
              {config.icon}
            </span>
          )}
          <div className="node-header-text">
            <div className="node-type-badge">{config.label}</div>
            <div
              className="node-label nodrag"
              title="Double-click to rename"
              onDoubleClick={(event) => {
                event.stopPropagation()
                startEditing(id)
              }}
            >
              {nodeData.label}
            </div>
            <ChangeStatusBadge status={nodeData.properties.changeStatus} compact />
          </div>
        </div>
        {showApiSpec && spec && (
          <div className="node-api-spec">
            <button
              type="button"
              className="node-api-spec-btn"
              onClick={() => setShowSpecModal(true)}
              aria-label="View API"
              title="View API"
            >
              <FileCode size={14} />
              <span className="node-api-spec-label">API</span>
            </button>
          </div>
        )}
        <div className="node-footer">
          <span className="node-category">
            {nodeData.category}
            {infraSummary && !isIcon ? <span className="node-infra"> · {infraSummary}</span> : null}
          </span>
          <div className="node-footer-badges">
            <NotesBadge notes={nodeData.properties.notes} compact title={nodeData.label} />
            <WorkItemBadge fields={nodeData.properties} compact />
            <CodeLinkBadge properties={nodeData.properties} compact />
            {nodeData.hasChangeTask && <ChangeDesignBadge compact />}
          </div>
        </div>
      </div>
      {showSpecModal && spec && (
        <InterfaceSpecModal spec={spec} onClose={() => setShowSpecModal(false)} />
      )}
    </>
  )
}
