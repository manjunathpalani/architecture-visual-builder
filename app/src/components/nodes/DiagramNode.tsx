import { NodeResizer, type NodeProps } from '@xyflow/react'
import type { DiagramShape } from '../../types'
import { DiagramShapeRenderer } from '../icons/DiagramShapes'
import type { IntegrationNodeData } from '../../utils/jsonIO'
import { getNodeColor } from '../../utils/nodeStyle'
import { CodeLinkBadge } from '../CodeLinkBadge'
import { WorkItemBadge } from '../WorkItemBadge'
import { SubDiagramBadge } from '../SubDiagramBadge'
import { ChangeStatusBadge } from '../ChangeStatusBadge'
import { parseChangeStatus } from '../../utils/architectureState'
import { NodeConnectors } from './NodeConnectors'

export function DiagramNode({ data, selected }: NodeProps) {
  const nodeData = data as IntegrationNodeData
  const shape = (nodeData.properties.shape ?? 'process') as DiagramShape
  const color = getNodeColor(nodeData)
  const changeStatus = parseChangeStatus(nodeData.properties.changeStatus)

  return (
    <>
      <NodeResizer
        minWidth={100}
        minHeight={80}
        isVisible={selected}
        lineClassName="resize-line"
        handleClassName="resize-handle"
      />
      <div
        className={`diagram-node-wrapper resizable-node ${selected ? 'selected' : ''} ${nodeData.isFlowFocus ? 'flow-focus' : ''} ${nodeData.isFlowNeighbor ? 'flow-neighbor' : ''} ${nodeData.isFlowPath ? 'flow-path' : ''} change-${changeStatus} ${nodeData.isStateContext ? 'state-context' : ''}`}
        style={{ '--diagram-color': color } as React.CSSProperties}
      >
        <NodeConnectors variant="diagram" />
        <ChangeStatusBadge status={nodeData.properties.changeStatus} compact />
        <DiagramShapeRenderer
          shape={shape}
          label={nodeData.label}
          selected={selected}
          properties={nodeData.properties}
        />
        <div className="diagram-code-badge">
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
    </>
  )
}