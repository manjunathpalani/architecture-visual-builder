import { NodeResizer, type NodeProps } from '@xyflow/react'
import type { IntegrationNodeData } from '../../utils/jsonIO'
import { NodeConnectors } from './NodeConnectors'
import { withNodeFontSize } from '../../utils/nodeFontSize'
import { useDiagramLock } from './diagramLockContext'
import { InlineNodeTitleEditor } from './InlineNodeTitleEditor'
import { useNodeTitleEdit } from './nodeTitleEditContext'

export function GroupNode({ id, data, selected }: NodeProps) {
  const layoutLocked = useDiagramLock()
  const { startEditing } = useNodeTitleEdit()
  const nodeData = data as IntegrationNodeData
  const color = nodeData.properties.color ?? '#94a3b8'

  return (
    <>
      <InlineNodeTitleEditor nodeId={id} label={nodeData.label} />
      <NodeResizer
        minWidth={120}
        minHeight={72}
        isVisible={selected && !layoutLocked}
        lineClassName="resize-line"
        handleClassName="resize-handle"
      />
      <NodeConnectors variant="shape" />
      <div
        className={`group-node resizable-node ${selected ? 'selected' : ''}`}
        style={withNodeFontSize(nodeData.properties, { '--group-color': color } as React.CSSProperties)}
      >
        <div
          className="group-label nodrag"
          title="Double-click to rename"
          onDoubleClick={(event) => {
            event.stopPropagation()
            startEditing(id)
          }}
        >
          {nodeData.label}
        </div>
      </div>
    </>
  )
}
