import { NodeResizer, type NodeProps } from '@xyflow/react'
import type { IntegrationNodeData } from '../../utils/jsonIO'
import { NodeConnectors } from './NodeConnectors'

export function GroupNode({ data, selected }: NodeProps) {
  const nodeData = data as IntegrationNodeData
  const color = nodeData.properties.color ?? '#94a3b8'

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={120}
        isVisible={selected}
        lineClassName="resize-line"
        handleClassName="resize-handle"
      />
      <NodeConnectors variant="shape" />
      <div
        className={`group-node resizable-node ${selected ? 'selected' : ''}`}
        style={{ '--group-color': color } as React.CSSProperties}
      >
        <div className="group-label">{nodeData.label}</div>
      </div>
    </>
  )
}