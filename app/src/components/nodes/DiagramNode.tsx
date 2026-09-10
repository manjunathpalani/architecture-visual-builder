import { NodeResizer, type NodeProps } from '@xyflow/react'
import type { DiagramShape } from '../../types'
import { DiagramShapeRenderer } from '../icons/DiagramShapes'
import type { IntegrationNodeData } from '../../utils/jsonIO'
import { getNodeColor } from '../../utils/nodeStyle'
import { CodeLinkBadge } from '../CodeLinkBadge'
import { WorkItemBadge } from '../WorkItemBadge'
import { SubDiagramBadge } from '../SubDiagramBadge'
import { ChangeStatusBadge } from '../ChangeStatusBadge'
import { ChangeDesignBadge } from '../ChangeDesignBadge'
import { parseChangeStatus } from '../../utils/architectureState'
import { NodeConnectors } from './NodeConnectors'
import { withNodeFontSize } from '../../utils/nodeFontSize'
import { useDiagramLock } from './diagramLockContext'
import { InlineNodeTitleEditor } from './InlineNodeTitleEditor'
import { useNodeTitleEdit } from './nodeTitleEditContext'

export function DiagramNode({ id, data, selected }: NodeProps) {
  const layoutLocked = useDiagramLock()
  const { startEditing } = useNodeTitleEdit()
  const nodeData = data as IntegrationNodeData
  const shape = (nodeData.properties.shape ?? 'process') as DiagramShape
  const color = getNodeColor(nodeData)
  const changeStatus = parseChangeStatus(nodeData.properties.changeStatus)

  return (
    <>
      <InlineNodeTitleEditor nodeId={id} label={nodeData.label} />
      <NodeResizer
        minWidth={64}
        minHeight={48}
        isVisible={selected && !layoutLocked}
        lineClassName="resize-line"
        handleClassName="resize-handle"
      />
      <div
        className={`diagram-node-wrapper resizable-node ${selected ? 'selected' : ''} ${nodeData.isFlowFocus ? 'flow-focus' : ''} ${nodeData.isFlowNeighbor ? 'flow-neighbor' : ''} ${nodeData.isFlowPath ? 'flow-path' : ''} ${nodeData.showTouchPoints ? 'show-touch-points' : ''} change-${changeStatus} ${nodeData.isStateContext ? 'state-context' : ''}`}
        style={withNodeFontSize(nodeData.properties, { '--diagram-color': color } as React.CSSProperties)}
        title="Double-click to rename"
        onDoubleClick={(event) => {
          event.stopPropagation()
          startEditing(id)
        }}
      >
        <NodeConnectors variant="diagram" />
        {nodeData.hasSubDiagramContent && (
          <SubDiagramBadge
            nodeId={id}
            label={nodeData.label}
            systems={nodeData.subDiagramStats?.systems}
            integrations={nodeData.subDiagramStats?.integrations}
            compact
          />
        )}
        <ChangeStatusBadge status={nodeData.properties.changeStatus} compact />
        <DiagramShapeRenderer
          shape={shape}
          label={nodeData.label}
          selected={selected}
          properties={nodeData.properties}
        />
        <div className="diagram-code-badge">
          <WorkItemBadge fields={nodeData.properties} compact />
          <CodeLinkBadge properties={nodeData.properties} compact />
          {nodeData.hasChangeTask && <ChangeDesignBadge compact />}
        </div>
      </div>
    </>
  )
}
