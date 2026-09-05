import { NodeResizer, type NodeProps } from '@xyflow/react'
import { SYSTEM_TYPE_CONFIG } from '../../types'
import type { IntegrationNodeData } from '../../utils/jsonIO'
import { getNodeColor } from '../../utils/nodeStyle'
import { ServiceIcon, getServiceIconFromLabel } from '../icons/ServiceIcons'
import { CodeLinkBadge } from '../CodeLinkBadge'
import { WorkItemBadge } from '../WorkItemBadge'
import { SubDiagramBadge } from '../SubDiagramBadge'
import { InterfaceSpecViewer } from '../InterfaceSpecViewer'
import { isApiNode, nodeHasInterfaceSpec } from '../../utils/apiComponent'
import { getSpecFromProperties } from '../../types/interfaceSpec'
import { useState } from 'react'
import { InterfaceSpecModal } from '../InterfaceSpecModal'
import { ChangeStatusBadge } from '../ChangeStatusBadge'
import { parseChangeStatus } from '../../utils/architectureState'
import { NodeConnectors } from './NodeConnectors'

export function IntegrationNode({ data, selected }: NodeProps) {
  const nodeData = data as IntegrationNodeData
  const config = SYSTEM_TYPE_CONFIG[nodeData.systemType]
  const color = getNodeColor(nodeData)
  const fallbackIcon = getServiceIconFromLabel(nodeData.label, nodeData.systemType)
  const hasServiceIcon = Boolean(nodeData.properties.service) || Boolean(fallbackIcon)
  const showApiSpec = isApiNode(nodeData) && nodeHasInterfaceSpec(nodeData)
  const spec = getSpecFromProperties(nodeData.properties)
  const [showSpecModal, setShowSpecModal] = useState(false)
  const changeStatus = parseChangeStatus(nodeData.properties.changeStatus)

  return (
    <>
      <NodeResizer
        minWidth={140}
        minHeight={70}
        isVisible={selected}
        lineClassName="resize-line"
        handleClassName="resize-handle"
      />
      <div
        className={`integration-node resizable-node ${selected ? 'selected' : ''} ${nodeData.isFlowFocus ? 'flow-focus' : ''} ${nodeData.isFlowNeighbor ? 'flow-neighbor' : ''} ${nodeData.isFlowPath ? 'flow-path' : ''} change-${changeStatus} ${nodeData.isStateContext ? 'state-context' : ''}`}
        style={{ '--node-color': color } as React.CSSProperties}
      >
        <NodeConnectors />
        <div className="node-header">
          {hasServiceIcon ? (
            <div className="node-service-icon">
              {nodeData.properties.service ? (
                <ServiceIcon
                  vendor={nodeData.properties.vendor}
                  service={nodeData.properties.service}
                  size={28}
                />
              ) : (
                fallbackIcon
              )}
            </div>
          ) : (
            <span className="node-emoji-icon">{config.icon}</span>
          )}
          <div className="node-header-text">
            <div className="node-type-badge">{config.label}</div>
            <div className="node-label">{nodeData.label}</div>
            <ChangeStatusBadge status={nodeData.properties.changeStatus} compact />
          </div>
        </div>
        {showApiSpec && spec && (
          <div
            className="node-api-spec"
            onClick={() => setShowSpecModal(true)}
            onKeyDown={(e) => e.key === 'Enter' && setShowSpecModal(true)}
            role="button"
            tabIndex={0}
          >
            <InterfaceSpecViewer spec={spec} compact maxEndpoints={3} />
          </div>
        )}
        <div className="node-footer">
          <span className="node-category">{nodeData.category}</span>
          <div className="node-footer-badges">
            {nodeData.hasSubDiagramContent && nodeData.subDiagramStats && (
              <SubDiagramBadge
                systems={nodeData.subDiagramStats.systems}
                integrations={nodeData.subDiagramStats.integrations}
                compact
              />
            )}
            <WorkItemBadge fields={nodeData.properties} compact />
            <CodeLinkBadge properties={nodeData.properties} compact />
          </div>
        </div>
      </div>
      {showSpecModal && spec && (
        <InterfaceSpecModal spec={spec} onClose={() => setShowSpecModal(false)} />
      )}
    </>
  )
}