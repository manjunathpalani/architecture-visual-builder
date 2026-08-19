import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import type { DiagramShape } from '../../types'
import { DiagramShapeRenderer } from '../icons/DiagramShapes'
import type { IntegrationNodeData } from '../../utils/jsonIO'
import { getNodeColor } from '../../utils/nodeStyle'
import { CodeLinkBadge } from '../CodeLinkBadge'
import { SubDiagramBadge } from '../SubDiagramBadge'
import { ChangeStatusBadge } from '../ChangeStatusBadge'
import { parseChangeStatus } from '../../utils/architectureState'

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
        <Handle type="target" position={Position.Top} id="t-top" className="node-handle diagram-handle" />
        <Handle type="source" position={Position.Top} id="s-top" className="node-handle diagram-handle" />
        <Handle type="target" position={Position.Left} id="t-left" className="node-handle diagram-handle" />
        <Handle type="source" position={Position.Left} id="s-left" className="node-handle diagram-handle" />
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
          <CodeLinkBadge properties={nodeData.properties} compact />
        </div>
        <Handle type="target" position={Position.Right} id="t-right" className="node-handle diagram-handle" />
        <Handle type="source" position={Position.Right} id="s-right" className="node-handle diagram-handle" />
        <Handle type="target" position={Position.Bottom} id="t-bottom" className="node-handle diagram-handle" />
        <Handle type="source" position={Position.Bottom} id="s-bottom" className="node-handle diagram-handle" />
      </div>
    </>
  )
}